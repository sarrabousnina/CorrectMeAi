# corrector.py
import os, re
from difflib import SequenceMatcher
from datetime import datetime
from bson import ObjectId
from pymongo import MongoClient

# ---------- DB ----------
MONGO_URI = os.getenv(
    "MONGO_URI",
    "mongodb+srv://admin:admin@examcluster.dpdod2i.mongodb.net/?retryWrites=true&w=majority&appName=ExamCluster"
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
    if isinstance(x, (int, float)): return float(x)
    m = re.search(r"[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?", str(x or ""))
    return float(m.group(0)) if m else None

def _grade_one(qtype, expected, student, pts, allow_near=False):
    awarded = 0.0
    if qtype in ("text", "short_text"):
        if isinstance(expected, list):
            exact = any(_norm(student) == _norm(x) for x in expected)
            near  = any(_similar(student, x) >= 0.92 for x in expected)
        else:
            exact = _norm(student) == _norm(expected)
            near  = _similar(student, expected) >= 0.92
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
        if "value" in expected:
            ok = sval is not None and abs(sval - float(expected["value"])) <= tol
        else:
            ok = any(sval is not None and abs(sval - float(v)) <= tol for v in expected.get("values", []))
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
    if not sub: return {"error": "Submission not found."}
    exam = exams.find_one({"_id": sub["exam_id"]})
    if not exam: return {"error": "Exam not found."}

    key = exam.get("answer_key") or []
    stud = sub.get("answers_structured") or {}
    if not key or not stud: return {"error": "Missing answer key or student answers."}

    defined = sum(float(i.get("points", 0)) for i in key)
    if defined <= 0:
        per = 20.0 / max(1, len(key))
        for i in key: i["points"] = per
    else:
        scale = 20.0 / defined
        for i in key: i["points"] = float(i.get("points", 0)) * scale

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
        details.append({
            "index": idx+1, "question_id": qid or f"Q{idx+1}",
            "matched_student_key": stud_key if stud_key in stud else None,
            "type": qtype, "points": round(pts,3), "awarded": round(got,3),
            "expected": expected, "student": student_answer, "comment": comment
        })

    total = max(0.0, min(20.0, round(total, 3)))
    wrong = [d for d in details if d["awarded"] + 1e-9 < d["points"]]
    if total == 20.0:
        feedback = "Excellent — all answers correct."
    elif total == 0.0:
        feedback = "Most answers are incorrect or missing. Please review and try again."
    else:
        missed = ", ".join((d["question_id"] or f'#{d["index"]}') for d in wrong[:5])
        feedback = f"Several incorrect/missing answers (e.g., {missed}). Revise those topics."

    submissions.update_one({"_id": sub["_id"]}, {"$set": {
        "score": total, "feedback": feedback, "grading_details": details
    }})
    return {"score": total, "feedback": feedback, "details_count": len(details)}

# ---------- Flask API ----------
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

def _to_json(doc):
    if not doc: return None
    out = {}
    for k, v in doc.items():
        if isinstance(v, ObjectId): out[k] = str(v)
        else: out[k] = v
    if "exam_id" in out and isinstance(out["exam_id"], ObjectId):
        out["exam_id"] = str(out["exam_id"])
    return out

@app.get("/health")
def health():
    return jsonify({"ok": True})

# Get one submission (used by Result page)
@app.get("/api/submissions/<sid>")
def api_get_submission(sid):
    doc = submissions.find_one({"_id": ObjectId(sid)})
    if not doc: return jsonify({"error": "not found"}), 404
    return jsonify(_to_json(doc))

# Regrade one submission and save score/feedback
@app.get("/submissions/<sid>/regrade")
def api_regrade(sid):
    r = score_submission(sid, allow_near=False)
    if "error" in r: return jsonify(r), 400
    # return the updated doc for convenience
    doc = submissions.find_one({"_id": ObjectId(sid)})
    return jsonify(_to_json(doc))

# Optional: latest submission, optionally filtered by student
@app.get("/api/submissions/latest")
def api_latest_submission():
    student_id = request.args.get("student_id")
    q = {"student_id": student_id} if student_id else {}
    cur = submissions.find(q).sort([("created_at", -1), ("_id", -1)]).limit(1)
    doc = next(cur, None)
    if not doc: return jsonify({"error": "not found"}), 404
    return jsonify(_to_json(doc))

# Optional: fetch exam title
@app.get("/api/exams/<eid>")
def api_get_exam(eid):
    doc = exams.find_one({"_id": ObjectId(eid)}, {"title": 1})
    if not doc: return jsonify({"error": "not found"}), 404
    doc["_id"] = str(doc["_id"])
    return jsonify(doc)

if __name__ == "__main__":
    # pip install flask flask-cors pymongo dnspython
    port = int(os.getenv("PORT", "5005"))
    app.run(host="0.0.0.0", port=port, debug=True)
