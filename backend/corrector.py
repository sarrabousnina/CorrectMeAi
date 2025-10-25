import os
import re
from difflib import SequenceMatcher
from bson import ObjectId
from pymongo import MongoClient, DESCENDING
from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# ---------- DB ----------
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
client = MongoClient(MONGO_URI)
db = client["exam_system"]
submissions = db["submissions"]
exams = db["exams"]

submissions.create_index([("created_at", DESCENDING), ("_id", DESCENDING)])
exams.create_index([("created_at", DESCENDING), ("_id", DESCENDING)])

# ---------- Grading Configuration ----------
ALLOWED_STEPS = (1.0, 0.5, 0.25)

def _nearest_allowed(x: float) -> float:
    try:
        x = float(x)
    except (TypeError, ValueError):
        return 0.0
    if x <= 0:
        return 0.0
    return max(ALLOWED_STEPS, key=lambda s: (-(abs(s - x)), s))

def _ensure_allowed_points(v) -> float:
    try:
        return _nearest_allowed(float(v))
    except (TypeError, ValueError):
        return 0.0

# ---------- Text & Answer Helpers ----------
def _norm(s):
    if s is None:
        return ""
    return re.sub(r"\s+", " ", str(s).strip().lower())

def _similar(a, b):
    return SequenceMatcher(None, _norm(a), _norm(b)).ratio()

def _num(x):
    if isinstance(x, (int, float)):
        return float(x)
    match = re.search(r"[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?", str(x or ""))
    return float(match.group()) if match else None

def _as_list(v):
    if v is None:
        return []
    if isinstance(v, list):
        return v
    if isinstance(v, dict):
        def _key_sort(k):
            m = re.match(r"([a-zA-Z]+)|(\d+)", str(k))
            if not m:
                return (2, str(k))
            return (0, m.group(1)) if m.group(1) else (1, int(m.group(2)))
        return [v[k] for k in sorted(v.keys(), key=_key_sort)]
    parts = re.split(r"[,\;\|\n/]+", str(v))
    return [p.strip() for p in parts if p.strip()]

# ---------- Grading Logic ----------
def _grade_leaf(qtype, expected, student, pts, allow_near=False):
    awarded = 0.0
    student_norm = _norm(student)

    if qtype in ("text", "short_text"):
        if isinstance(expected, list):
            exact = any(_norm(x) == student_norm for x in expected)
            near = any(_similar(student, x) >= 0.92 for x in expected)
        else:
            exact = _norm(expected) == student_norm
            near = _similar(student, expected) >= 0.92
        awarded = pts if exact else (pts * 0.5 if allow_near and near else 0.0)

    elif qtype == "mcq_single":
        awarded = pts if _norm(expected) == student_norm else 0.0

    elif qtype == "true_false":
        awarded = pts if student_norm in {"true", "false"} and student_norm == _norm(expected) else 0.0

    elif qtype == "numeric":
        if not isinstance(expected, dict):
            expected = {"value": expected}
        tolerance = float(expected.get("tolerance", 0))
        sval = _num(student)
        if "value" in expected:
            ok = sval is not None and abs(sval - float(expected["value"])) <= tolerance
        else:
            ok = any(
                sval is not None and abs(sval - float(v)) <= tolerance
                for v in expected.get("values", [])
            )
        awarded = pts if ok else 0.0

    elif qtype == "regex":
        pattern = str(expected)
        ok = re.fullmatch(pattern, str(student or ""), re.IGNORECASE) is not None
        awarded = pts if ok else 0.0

    else:
        awarded = pts if _norm(expected) == student_norm else 0.0

    return max(0.0, min(float(pts), awarded))

def _expand_to_subparts(item):
    qtype = item.get("type", "text")
    subparts = item.get("subparts")

    if subparts and isinstance(subparts, list):
        out = []
        for i, sp in enumerate(subparts):
            stype = sp.get("type", qtype)
            exp = sp.get("expected", sp.get("answer"))
            pts = _ensure_allowed_points(sp.get("points", 0))
            sid = sp.get("id", chr(ord('a') + i))
            out.append({"id": sid, "type": stype, "expected": exp, "points": pts})
        total = sum(float(x["points"]) for x in out)
        return out, total

    expected = item.get("expected_answer")
    if isinstance(expected, list) and expected:
        n = len(expected)
        default_per = 1.0 if n == 1 else (0.5 if n in (2, 3) else 0.25)
        out = []
        for i, exp in enumerate(expected):
            sid = chr(ord('a') + i)
            if isinstance(exp, dict):
                stype = exp.get("type", qtype)
                e = exp.get("expected", exp.get("answer"))
                p = _ensure_allowed_points(exp.get("points", default_per))
            else:
                stype, e, p = qtype, exp, default_per
            out.append({"id": sid, "type": stype, "expected": e, "points": p})
        total = sum(float(x["points"]) for x in out)
        return out, total

    return [{"id": "a", "type": qtype, "expected": expected, "points": 1.0}], 1.0

def _pick_student_for_sub(student_answer, sub_index, sub_id):
    if isinstance(student_answer, dict):
        if sub_id in student_answer:
            return student_answer[sub_id]
        if str(sub_index + 1) in student_answer:
            return student_answer[str(sub_index + 1)]
        as_list = _as_list(student_answer)
        return as_list[sub_index] if sub_index < len(as_list) else None

    if isinstance(student_answer, list):
        return student_answer[sub_index] if sub_index < len(student_answer) else None

    parts = _as_list(student_answer)
    return parts[sub_index] if sub_index < len(parts) else None

def _grade_item(item, student_answer, allow_near=False):
    subparts, pts_total = _expand_to_subparts(item)
    awarded_total = 0.0
    details = []

    for i, sp in enumerate(subparts):
        s_ans = _pick_student_for_sub(student_answer, i, sp["id"])
        awarded = _grade_leaf(sp["type"], sp["expected"], s_ans, float(sp["points"]), allow_near)
        awarded_total += awarded
        details.append({
            "sub_id": sp["id"],
            "type": sp["type"],
            "points": round(float(sp["points"]), 3),
            "awarded": round(awarded, 3),
            "expected": sp["expected"],
            "student": s_ans,
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

    expanded_key = []
    max_points = 0.0
    for item in key:
        subs, pts = _expand_to_subparts(item)
        expanded_key.append({**item, "_expanded_subparts": subs, "_expanded_points_total": pts})
        max_points += pts

    details = []
    student_raw_total = 0.0

    for idx, item in enumerate(expanded_key):
        qid = str(item.get("question_id") or "").strip()
        stud_key = qid if qid in stud else f"Q{idx + 1}"
        student_answer = stud.get(stud_key)

        awarded, _, sub_details = _grade_item(item, student_answer, allow_near)
        item_points = float(item["_expanded_points_total"])
        item_awarded = awarded

        student_raw_total += item_awarded
        details.append({
            "index": idx + 1,
            "question_id": qid or f"Q{idx + 1}",
            "matched_student_key": stud_key if stud_key in stud else None,
            "type": item.get("type", "text"),
            "points": round(item_points, 3),
            "awarded": round(item_awarded, 3),
            "expected": item.get("expected_answer"),
            "student": student_answer,
            "subparts": sub_details,
        })

    score = 0.0
    if max_points > 0:
        normalized = (student_raw_total * 20.0) / max_points
        score = round(normalized * 4) / 4.0
        score = max(0.0, min(20.0, round(score, 2)))

    wrong = [d for d in details if d["awarded"] < d["points"] - 1e-5]
    if score == 20.0:
        feedback = "Excellent — all answers correct."
    elif score == 0.0:
        feedback = "Most answers are incorrect or missing. Please review and try again."
    else:
        missed = ", ".join((d["question_id"] or f'#{d["index"]}') for d in wrong[:5])
        feedback = f"Several incorrect/missing answers (e.g., {missed}). Revise those topics."

    submissions.update_one(
        {"_id": sub["_id"]},
        {
            "$set": {
                "score": score,
                "score_raw": round(student_raw_total, 3),
                "max_points": round(max_points, 3),
                "feedback": feedback,
                "grading_details": details,
            }
        },
    )
    return {"score": score, "feedback": feedback, "details_count": len(details)}

def _as_oid_or_str(v):
    try:
        return ObjectId(v)
    except Exception:
        return v

# ---------- Flask App ----------
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
    return ("", 204)

@app.get("/health")
def health():
    return jsonify({"ok": True})

# Import auth decorators (assumes they are defined in a shared module)
from auth import require_role

@app.get("/api/exams/<eid>/submissions")
@require_role("admin", "instructor")
def api_submissions_by_exam(eid):
    oid = _as_oid_or_str(eid)
    ex = exams.find_one({"_id": oid}, {"title": 1})
    exam_obj = {"_id": str(oid), "title": ex.get("title") if ex else None}
    items = []
    for doc in submissions.find({"exam_id": oid}).sort([("created_at", -1), ("_id", -1)]):
        doc["_id"] = str(doc["_id"])
        if isinstance(doc.get("exam_id"), ObjectId):
            doc["exam_id"] = str(doc["exam_id"])
        items.append(doc)
    return jsonify({"exam": exam_obj, "items": items})

@app.get("/api/exams/latest/submissions")
@require_role("admin", "instructor")
def api_latest_exam_submissions():
    latest = exams.find_one(sort=[("created_at", -1), ("_id", -1)])
    if not latest:
        return jsonify({"error": "No exams found"}), 404
    exam_obj = {"_id": str(latest["_id"]), "title": latest.get("title", "Untitled Exam")}
    items = []
    for doc in submissions.find({"exam_id": latest["_id"]}).sort([("created_at", -1), ("_id", -1)]):
        doc["_id"] = str(doc["_id"])
        if isinstance(doc.get("exam_id"), ObjectId):
            doc["exam_id"] = str(doc["exam_id"])
        items.append(doc)
    return jsonify({"exam": exam_obj, "items": items})

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

@app.post("/api/submissions/<sid>/regrade")
@require_role("admin", "instructor")
def api_regrade_post(sid):
    result = score_submission(sid, allow_near=False)
    if "error" in result:
        return jsonify(result), 400
    doc = submissions.find_one({"_id": ObjectId(sid)})
    doc["_id"] = str(doc["_id"])
    if isinstance(doc.get("exam_id"), ObjectId):
        doc["exam_id"] = str(doc["exam_id"])
    return jsonify(doc)

@app.get("/api/submissions/latest")
@require_role("admin", "instructor")
def api_latest_submission():
    student_id = request.args.get("student_id")
    query = {"student_id": student_id} if student_id else {}
    doc = submissions.find_one(query, sort=[("created_at", -1), ("_id", -1)])
    if not doc:
        return jsonify({"error": "not found"}), 404
    doc["_id"] = str(doc["_id"])
    if isinstance(doc.get("exam_id"), ObjectId):
        doc["exam_id"] = str(doc["exam_id"])
    return jsonify(doc)

if __name__ == "__main__":
    port = int(os.getenv("PORT", "5005"))
    app.run(host="0.0.0.0", port=port, debug=True)