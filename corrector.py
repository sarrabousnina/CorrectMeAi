# corrector.py
import os
import re
from difflib import SequenceMatcher
from bson import ObjectId
from pymongo import MongoClient

# ---------- DB ----------
MONGO_URI = os.getenv(
    "MONGO_URI",
    "mongodb+srv://admin:admin@examcluster.dpdod2i.mongodb.net/?retryWrites=true&w=majority&appName=ExamCluster",
)
client = MongoClient(MONGO_URI)
db = client["exam_system"]
submissions = db["submissions"]
exams = db["exams"]

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


def _grade_one(qtype, expected, student, pts, allow_near=False):
    awarded = 0.0
    if qtype in ("text", "short_text"):
        if isinstance(expected, list):
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
            ok = any(
                sval is not None and abs(sval - float(v)) <= tol
                for v in (expected or {}).get("values", [])
            )
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


def score_submission(submission_id: str, allow_near=False):
    sub = submissions.find_one({"_id": ObjectId(submission_id)})
    if not sub:
        return {"error": "Submission not found."}

    # Only light fields from exam (ignore heavy fields like images)
    exam = exams.find_one({"_id": sub["exam_id"]}, {"answer_key": 1, "title": 1})
    if not exam:
        return {"error": "Exam not found."}

    key = exam.get("answer_key") or []
    stud = sub.get("answers_structured") or {}
    if not key or not stud:
        return {"error": "Missing answer key or student answers."}

    defined = sum(float(i.get("points", 0)) for i in key)
    if defined <= 0:
        per = 20.0 / max(1, len(key))
        for i in key:
            i["points"] = per
    else:
        scale = 20.0 / defined
        for i in key:
            i["points"] = float(i.get("points", 0)) * scale

    total, details = 0.0, []
    for idx, item in enumerate(key):
        qid = str(item.get("question_id") or "").strip()
        qtype = item.get("type", "text")
        expected = item.get("expected_answer")
        pts = float(item.get("points", 0))
        stud_key = qid if qid in stud else f"Q{idx+1}"
        student_answer = stud.get(stud_key)
        got, comment = _grade_one(qtype, expected, student_answer, pts, allow_near)
        total += got
        details.append(
            {
                "index": idx + 1,
                "question_id": qid or f"Q{idx+1}",
                "matched_student_key": stud_key if stud_key in stud else None,
                "type": qtype,
                "points": round(pts, 3),
                "awarded": round(got, 3),
                "expected": expected,
                "student": student_answer,
                "comment": comment,
            }
        )

    total = max(0.0, min(20.0, round(total, 3)))
    wrong = [d for d in details if d["awarded"] + 1e-9 < d["points"]]
    if total == 20.0:
        feedback = "Excellent — all answers correct."
    elif total == 0.0:
        feedback = "Most answers are incorrect or missing. Please review and try again."
    else:
        missed = ", ".join((d["question_id"] or f'#{d["index"]}') for d in wrong[:5])
        feedback = f"Several incorrect/missing answers (e.g., {missed}). Revise those topics."

    submissions.update_one(
        {"_id": sub["_id"]},
        {"$set": {"score": total, "feedback": feedback, "grading_details": details}},
    )
    return {"score": total, "feedback": feedback, "details_count": len(details)}


def _as_oid_or_str(v):
    try:
        return ObjectId(v)
    except Exception:
        return v


# ---------- Flask API ----------
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)

# --- CORS: allow React dev server & preflights ---
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
    # Ensure the preflight & actual responses carry the correct headers
    resp.headers.setdefault("Access-Control-Allow-Origin", FRONTEND_ORIGIN)
    resp.headers.setdefault("Vary", "Origin")
    resp.headers.setdefault("Access-Control-Allow-Headers", "Content-Type, Authorization")
    resp.headers.setdefault("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
    return resp

# Explicit preflight endpoints so OPTIONS always returns 200 OK
@app.route("/api/<path:_any>", methods=["OPTIONS"])
def _preflight_api(_any):
    return ("", 200)

@app.route("/submissions/<path:_any>", methods=["OPTIONS"])
def _preflight_submissions(_any):
    return ("", 200)

# --- AUTH: register blueprint & decorators ---
from auth import make_auth_blueprint

auth_bp, require_auth, require_role = make_auth_blueprint(db)
app.register_blueprint(auth_bp)

def _to_json(doc):
    if not doc:
        return None
    out = {}
    for k, v in doc.items():
        out[k] = str(v) if isinstance(v, ObjectId) else v
    if "exam_id" in out and isinstance(out["exam_id"], ObjectId):
        out["exam_id"] = str(out["exam_id"])
    return out


# --- submissions for a specific exam ---
@app.get("/api/exams/<eid>/submissions")
@require_role("admin", "instructor")
def api_submissions_by_exam(eid):
    oid = _as_oid_or_str(eid)
    ex = exams.find_one({"_id": oid}, {"title": 1})
    exam_obj = {"_id": str(oid), "title": ex.get("title") if ex else None}
    cur = submissions.find({"exam_id": oid}).sort([("created_at", -1), ("_id", -1)])
    items = [_to_json(d) for d in cur]
    return jsonify({"exam": exam_obj, "items": items}), 200


# --- submissions for the *latest* exam ---
@app.get("/api/exams/latest/submissions")
@require_role("admin", "instructor")
def api_latest_exam_submissions():
    ex_cur = exams.find().sort([("created_at", -1), ("_id", -1)]).limit(1)
    latest = next(ex_cur, None)
    if not latest:
        return jsonify({"error": "No exams found"}), 404

    exam_obj = {"_id": str(latest["_id"]), "title": latest.get("title", "Untitled Exam")}
    cur = submissions.find({"exam_id": latest["_id"]}).sort(
        [("created_at", -1), ("_id", -1)]
    )
    items = [_to_json(d) for d in cur]
    return jsonify({"exam": exam_obj, "items": items}), 200


@app.get("/health")
def health():
    return jsonify({"ok": True})


# Get one submission (used by Result page)
@app.get("/api/submissions/<sid>")
@require_role("admin", "instructor")
def api_get_submission(sid):
    doc = submissions.find_one({"_id": ObjectId(sid)})
    if not doc:
        return jsonify({"error": "not found"}), 404
    return jsonify(_to_json(doc))


# Regrade one submission and save score/feedback (legacy GET)
@app.get("/submissions/<sid>/regrade")
@require_role("admin", "instructor")
def api_regrade_get(sid):
    r = score_submission(sid, allow_near=False)
    if "error" in r:
        return jsonify(r), 400
    doc = submissions.find_one({"_id": ObjectId(sid)})
    return jsonify(_to_json(doc))


# Preferred POST regrade endpoint
@app.post("/api/submissions/<sid>/regrade")
@require_role("admin", "instructor")
def api_regrade_post(sid):
    r = score_submission(sid, allow_near=False)
    if "error" in r:
        return jsonify(r), 400
    doc = submissions.find_one({"_id": ObjectId(sid)})
    return jsonify(_to_json(doc))


# Latest submission (optional student filter)
@app.get("/api/submissions/latest")
@require_role("admin", "instructor")
def api_latest_submission():
    student_id = request.args.get("student_id")
    q = {"student_id": student_id} if student_id else {}
    cur = submissions.find(q).sort([("created_at", -1), ("_id", -1)]).limit(1)
    doc = next(cur, None)
    if not doc:
        return jsonify({"error": "not found"}), 404
    return jsonify(_to_json(doc))


# Fetch exam title
@app.get("/api/exams/<eid>")
@require_role("admin", "instructor")
def api_get_exam(eid):
    doc = exams.find_one({"_id": ObjectId(eid)}, {"title": 1})
    if not doc:
        return jsonify({"error": "not found"}), 404
    doc["_id"] = str(doc["_id"])
    return jsonify(doc)


if __name__ == "__main__":
    # pip install flask flask-cors pymongo dnspython pyjwt bcrypt
    port = int(os.getenv("PORT", "5005"))
    app.run(host="0.0.0.0", port=port, debug=True)
