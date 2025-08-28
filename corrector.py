# corrector.py — GRADING/SUBMISSIONS ONLY on port 5005
import os
import re
from difflib import SequenceMatcher
from bson import ObjectId
from pymongo import MongoClient, DESCENDING

import config

# ---------- DB ----------
MONGO_URI = os.getenv("MONGO_URI", config.MONGO_URI)
client = MongoClient(MONGO_URI)
db = client["exam_system"]
submissions = db["submissions"]
exams = db["exams"]

submissions.create_index([("created_at", DESCENDING), ("_id", DESCENDING)])
exams.create_index([("created_at", DESCENDING), ("_id", DESCENDING)])

# ---------- Allowed point steps per input ----------
ALLOWED_STEPS = (1.0, 0.5, 0.25)

def _nearest_allowed(x: float) -> float:
    """Round x to the nearest allowed step (1, 0.5, 0.25). 0.0 if x <= 0."""
    try:
        x = float(x)
    except Exception:
        return 0.0
    if x <= 0:
        return 0.0
    # choose by absolute distance; tie goes to larger step
    best = max(ALLOWED_STEPS, key=lambda s: (-(abs(s - x)), s))
    return best

def _ensure_allowed_points(v: float) -> float:
    """Clamp/round to the nearest allowed step, or 0.0 if invalid."""
    try:
        return _nearest_allowed(float(v))
    except Exception:
        return 0.0

# ---------- grading helpers ----------
def _norm(s):
    s = "" if s is None else str(s)
    s = s.strip().lower()
    s = re.sub(r"\s+", " ", s)
    return s

def _similar(a, b):
    return SequenceMatcher(None, _norm(a), _norm(b)).ratio()

def _num(x):
    if isinstance(x, (int, float)):
        return float(x)
    m = re.search(r"[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?", str(x or ""))
    return float(m.group(0)) if m else None

def _as_list(v):
    """Normalize student multi-answers to a list (split strings by common delimiters)."""
    if v is None:
        return []
    if isinstance(v, list):
        return v
    if isinstance(v, dict):
        # natural-ish key order support (a,b,c or 1,2,3)
        def _k(k):
            m = re.match(r"([a-zA-Z]+)|(\d+)", str(k))
            if not m:
                return (2, str(k))
            if m.group(1):
                return (0, m.group(1))
            return (1, int(m.group(2)))
        return [v[k] for k in sorted(v.keys(), key=_k)]
    parts = re.split(r"[,\;\|\n/]+", str(v))
    return [p.strip() for p in parts if p.strip() != ""]

def _grade_leaf(qtype, expected, student, pts, allow_near=False):
    """Grade a single sub-answer (leaf) using RAW pts (1/0.5/0.25)."""
    awarded = 0.0
    comment = ""
    if qtype in ("text", "short_text"):
        if isinstance(expected, list) and all(isinstance(x, (str, int, float)) for x in expected):
            exact = any(_norm(student) == _norm(x) for x in expected)
            near = any(_similar(student, x) >= 0.92 for x in expected)
        else:
            exact = _norm(student) == _norm(expected)
            near = _similar(student, expected) >= 0.92
        awarded = pts if exact else (pts * 0.5 if allow_near and near else 0.0)
        comment = f"text: expected {expected}, got {student}"
    elif qtype == "mcq_single":
        awarded = pts if _norm(student) == _norm(expected) else 0.0
        comment = f"mcq_single: expected {expected}, got {student}"
    elif qtype == "true_false":
        ok = _norm(student) in {"true", "false"} and _norm(student) == _norm(expected)
        awarded = pts if ok else 0.0
        comment = f"true_false: expected {expected}, got {student}"
    elif qtype == "numeric":
        tol = float((expected or {}).get("tolerance", 0))
        sval = _num(student)
        if "value" in (expected or {}):
            ok = sval is not None and abs(sval - float(expected["value"])) <= tol
        else:
            ok = any(sval is not None and abs(sval - float(v)) <= tol for v in (expected or {}).get("values", []))
        awarded = pts if ok else 0.0
        comment = f"numeric: expected {expected}, got {student}"
    elif qtype == "regex":
        pat = expected if isinstance(expected, str) else str(expected)
        ok = re.fullmatch(pat, str(student or ""), flags=re.IGNORECASE) is not None
        awarded = pts if ok else 0.0
        comment = f"regex /{pat}/ vs {student}"
    else:
        awarded = pts if _norm(student) == _norm(expected) else 0.0
        comment = f"strict: expected {expected}, got {student}"
    return max(0.0, min(float(pts), float(awarded))), comment

def _expand_to_subparts(item):
    """
    Normalize an item into subparts list with **per-input points forced by count**:

        n == 1  -> 1.0 each
        n in {2,3} -> 0.5 each
        n >= 4 -> 0.25 each

    Exceptions:
    - If item['subparts'] exists, use those points (rounded to {1, 0.5, 0.25}).
    - If an element of expected_answer is a dict with explicit 'points', use it
      (still rounded to {1, 0.5, 0.25}).

    Returns (subparts, total_points_from_subparts BEFORE any scaling).
    """
    qtype = item.get("type", "text")
    subparts = item.get("subparts")

    # Explicit subparts
    if subparts and isinstance(subparts, list):
        out = []
        for i, sp in enumerate(subparts):
            stype = sp.get("type", qtype)
            exp = sp.get("expected", sp.get("answer", None))
            raw_pts = float(sp.get("points", 0) or 0)
            sp_pts = _ensure_allowed_points(raw_pts)
            sid = sp.get("id", chr(ord('a') + i))
            out.append({"id": sid, "type": stype, "expected": exp, "points": sp_pts})
        total = sum(float(x["points"]) for x in out)
        return out, total

    expected = item.get("expected_answer")

    # Multi-blank by count rule
    if isinstance(expected, list):
        n = len(expected)
        if n <= 0:
            return [], 0.0
        if n == 1:
            default_per = 1.0
        elif n in (2, 3):
            default_per = 0.5
        else:
            default_per = 0.25

        out = []
        for i, exp in enumerate(expected):
            sid = chr(ord('a') + i)
            if isinstance(exp, dict) and any(k in exp for k in ("expected", "answer", "points", "type")):
                stype = exp.get("type", qtype)
                e = exp.get("expected", exp.get("answer"))
                raw_p = float(exp.get("points", default_per))
                p = _ensure_allowed_points(raw_p)
            else:
                stype, e, p = qtype, exp, default_per
            out.append({"id": sid, "type": stype, "expected": e, "points": p})
        total = sum(float(x["points"]) for x in out)
        return out, total

    # Single-input fallback
    return [{"id": "a", "type": qtype, "expected": expected, "points": 1.0}], 1.0

def _pick_student_for_sub(student_answer, sub_index, sub_id):
    """Map student's composite answer to a single subpart value."""
    if isinstance(student_answer, dict):
        if sub_id in student_answer:
            return student_answer.get(sub_id)
        if str(sub_index + 1) in student_answer:
            return student_answer.get(str(sub_index + 1))
        as_list = _as_list(student_answer)
        return as_list[sub_index] if sub_index < len(as_list) else None

    if isinstance(student_answer, list):
        return student_answer[sub_index] if sub_index < len(student_answer) else None

    parts = _as_list(student_answer)
    return parts[sub_index] if sub_index < len(parts) else None

def _grade_item(item, student_answer, allow_near=False):
    """
    Grade an item that may have subparts.
    Returns: (awarded_total_raw, pts_total_raw, per_sub_details_raw)
    """
    subparts, pts_total = _expand_to_subparts(item)
    details = []
    awarded_total = 0.0

    for i, sp in enumerate(subparts):
        s_ans = _pick_student_for_sub(student_answer, i, sp["id"])
        got, cmt = _grade_leaf(sp["type"], sp["expected"], s_ans, float(sp["points"]), allow_near)
        awarded_total += got
        details.append({
            "sub_id": sp["id"],
            "type": sp["type"],
            "points": round(float(sp["points"]), 3),   # RAW
            "awarded": round(got, 3),                  # RAW
            "expected": sp["expected"],
            "student": s_ans,
            "comment": cmt,
        })
    return awarded_total, pts_total, details

def score_submission(submission_id: str, allow_near=False):
    sub = submissions.find_one({"_id": ObjectId(submission_id)})
    if not sub:
        return {"error": "Submission not found."}

    exam = exams.find_one({"_id": sub["exam_id"]}, {"answer_key": 1, "title": 1})
    if not exam:
        return {"error": "Exam not found."}

    key = exam.get("answer_key") or []
    stud = sub.get("answers_structured") or {}
    if not key or not stud:
        return {"error": "Missing answer key or student answers."}

    # 1) Expand all items to subparts and accumulate RAW total points
    max_points = 0.0
    expanded_key = []
    for idx, item in enumerate(key):
        q = dict(item)  # shallow copy
        subs, pts_total = _expand_to_subparts(q)
        q["_expanded_subparts"] = subs
        q["_expanded_points_total"] = pts_total
        expanded_key.append(q)
        max_points += pts_total

    # 2) Grade each item (RAW only)
    details = []
    student_raw_total = 0.0

    for idx, item in enumerate(expanded_key):
        qid = str(item.get("question_id") or "").strip()
        qtype = item.get("type", "text")
        expected = item.get("expected_answer")
        pts_raw_total = float(item.get("_expanded_points_total") or 0.0)

        # choose student key by question_id or fallback Q{n}
        stud_key = qid if qid in stud else f"Q{idx+1}"
        student_answer = stud.get(stud_key)

        awarded_raw, _pts_total_raw, sub_details = _grade_item(item, student_answer, allow_near=allow_near)

        # RAW row totals
        item_points = round(pts_raw_total, 3)
        item_awarded = round(awarded_raw, 3)

        student_raw_total += item_awarded

        details.append({
            "index": idx + 1,
            "question_id": qid or f"Q{idx+1}",
            "matched_student_key": stud_key if stud_key in stud else None,
            "type": qtype,
            "points": item_points,           # RAW question total
            "awarded": item_awarded,         # RAW question awarded
            "expected": expected,
            "student": student_answer,
            "subparts": sub_details,         # each sub has RAW points/awarded + comment
        })

    # 3) Overall score normalized to /20 (table remains RAW)
    # 3) Overall score normalized to /20 and snapped to .25
    score = 0.0
    if max_points > 0:
        normalized = (student_raw_total * 20.0) / max_points    # 0..20
        score = round(normalized * 4) / 4.0                     # snap to 0.25 steps
    # clamp and give a clean 2-dec float (optional)
    score = max(0.0, min(20.0, float(f"{score:.2f}")))


    wrong = [d for d in details if d["awarded"] + 1e-9 < d["points"]]
    if score == 20.0:
        feedback = "Excellent — all answers correct."
    elif score == 0.0:
        feedback = "Most answers are incorrect or missing. Please review and try again."
    else:
        missed = ", ".join((d["question_id"] or f'#{d["index"]}') for d in wrong[:5])
        feedback = f"Several incorrect/missing answers (e.g., {missed}). Revise those topics."

    submissions.update_one(
        {"_id": sub["_id"]},
        {"$set": {
            "score": score,                          # /20 normalized
            "score_raw": round(student_raw_total, 3),# RAW sum awarded (for reference)
            "max_points": round(max_points, 3),      # RAW total possible (for reference)
            "feedback": feedback,
            "grading_details": details
        }},
    )
    return {"score": score, "feedback": feedback, "details_count": len(details)}

def _as_oid_or_str(v):
    try:
        return ObjectId(v)
    except Exception:
        return v

# ---------- Flask API ----------
from flask import Flask, jsonify, request, g
from flask_cors import CORS
from auth import require_auth, require_role  # decorators ONLY (no auth blueprint here)

app = Flask(__name__)

FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")
CORS(
    app,
    resources={
        r"/api/*": {"origins": [FRONTEND_ORIGIN]},
        r"/submissions/*": {"origins": [FRONTEND_ORIGIN]},
    },
    supports_credentials=False,
)

@app.after_request
def _add_cors_headers(resp):
    resp.headers.setdefault("Access-Control-Allow-Origin", FRONTEND_ORIGIN)
    resp.headers.setdefault("Vary", "Origin")
    resp.headers.setdefault("Access-Control-Allow-Headers", "Content-Type, Authorization")
    resp.headers.setdefault("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
    return resp

@app.route("/api/<path:_any>", methods=["OPTIONS"])
@app.route("/submissions/<path:_any>", methods=["OPTIONS"])
def _preflight_api(_any=None):
    return ("", 200)

@app.get("/health")
def health():
    return jsonify({"ok": True})

# ---- Submissions APIs (protected) ----

@app.get("/api/exams/<eid>/submissions")
@require_role("admin", "instructor")
def api_submissions_by_exam(eid):
    oid = _as_oid_or_str(eid)
    ex = exams.find_one({"_id": oid}, {"title": 1, "created_by": 1})
    exam_obj = {"_id": str(oid), "title": ex.get("title") if ex else None}
    cur = submissions.find({"exam_id": oid}).sort([("created_at", -1), ("_id", -1)])
    items = []
    for d in cur:
        d["_id"] = str(d["_id"])
        if isinstance(d.get("exam_id"), ObjectId):
            d["exam_id"] = str(d["exam_id"])
        items.append(d)
    return jsonify({"exam": exam_obj, "items": items}), 200

@app.get("/api/exams/latest/submissions")
@require_role("admin", "instructor")
def api_latest_exam_submissions():
    ex_cur = exams.find().sort([("created_at", -1), ("_id", -1)]).limit(1)
    latest = next(ex_cur, None)
    if not latest:
        return jsonify({"error": "No exams found"}), 404

    exam_obj = {"_id": str(latest["_id"]), "title": latest.get("title", "Untitled Exam")}
    cur = submissions.find({"exam_id": latest["_id"]}).sort([("created_at", -1), ("_id", -1)])
    items = []
    for d in cur:
        d["_id"] = str(d["_id"])
        if isinstance(d.get("exam_id"), ObjectId):
            d["exam_id"] = str(d["exam_id"])
        items.append(d)
    return jsonify({"exam": exam_obj, "items": items}), 200

@app.get("/api/submissions/<sid>")
@require_role("admin", "instructor")
def api_get_submission(sid):
    doc = submissions.find_one({"_id": ObjectId(sid)})
    if not doc:
        return jsonify({"error": "not found"}), 404
    doc["_id"] = str(doc["_id"])
    if isinstance(doc.get("exam_id"), ObjectId):
        doc["exam_id"] = str(doc["exam_id"])
    return jsonify(doc)

@app.get("/submissions/<sid>/regrade")
@require_role("admin", "instructor")
def api_regrade_get(sid):
    r = score_submission(sid, allow_near=False)
    if "error" in r:
        return jsonify(r), 400
    doc = submissions.find_one({"_id": ObjectId(sid)})
    doc["_id"] = str(doc["_id"])
    if isinstance(doc.get("exam_id"), ObjectId):
        doc["exam_id"] = str(doc["exam_id"])
    return jsonify(doc)

@app.post("/api/submissions/<sid>/regrade")
@require_role("admin", "instructor")
def api_regrade_post(sid):
    r = score_submission(sid, allow_near=False)
    if "error" in r:
        return jsonify(r), 400
    doc = submissions.find_one({"_id": ObjectId(sid)})
    doc["_id"] = str(doc["_id"])
    if isinstance(doc.get("exam_id"), ObjectId):
        doc["exam_id"] = str(doc["exam_id"])
    return jsonify(doc)

@app.get("/api/submissions/latest")
@require_role("admin", "instructor")
def api_latest_submission():
    student_id = request.args.get("student_id")
    q = {"student_id": student_id} if student_id else {}
    cur = submissions.find(q).sort([("created_at", -1), ("_id", -1)]).limit(1)
    doc = next(cur, None)
    if not doc:
        return jsonify({"error": "not found"}), 404
    doc["_id"] = str(doc["_id"])
    if isinstance(doc.get("exam_id"), ObjectId):
        doc["exam_id"] = str(doc["exam_id"])
    return jsonify(doc)

if __name__ == "__main__":
    port = int(os.getenv("PORT", "5005"))
    app.run(host="0.0.0.0", port=port, debug=True)
