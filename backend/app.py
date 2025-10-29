# app.py — MAIN BACKEND (auth + exams) on port 5006
import os
from datetime import datetime, timedelta
from bson import ObjectId
from flask import Flask, jsonify, request, g
from flask_cors import CORS
from pymongo import MongoClient, DESCENDING
from dotenv import load_dotenv

load_dotenv()

# ---------- DB ----------
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    raise RuntimeError("❌ Missing JWT_SECRET in .env")

client = MongoClient(MONGO_URI)
db = client["exam_system"]
exams = db["exams"]
submissions = db["submissions"]
users = db["users"]

users.create_index("email", unique=True)
exams.create_index([("created_at", DESCENDING), ("_id", DESCENDING)])
exams.create_index("created_by")

# ---------- APP / CORS ----------
app = Flask(__name__)

# Import and register AI blueprint from ai_assistant.py
from ai_assistant import bp_ai
app.register_blueprint(bp_ai, url_prefix="/ai")

FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")
CORS(
    app,
    resources={
        r"/api/*": {"origins": [FRONTEND_ORIGIN]},
        r"/ListExams": {"origins": [FRONTEND_ORIGIN]},
        r"/ai/*": {"origins": [FRONTEND_ORIGIN]},
    },
    supports_credentials=True,
)

@app.after_request
def _add_cors_headers(resp):
    resp.headers.setdefault("Access-Control-Allow-Origin", FRONTEND_ORIGIN)
    resp.headers.setdefault("Vary", "Origin")
    resp.headers.setdefault("Access-Control-Allow-Headers", "Content-Type, Authorization")
    resp.headers.setdefault("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
    resp.headers.setdefault("Access-Control-Allow-Credentials", "true")
    return resp

@app.route("/api/<path:_any>", methods=["OPTIONS"])
@app.route("/ListExams", methods=["OPTIONS"])
@app.route("/ai/<path:_any>", methods=["OPTIONS"])
def _preflight(_any=None):
    return ("", 200)

# ---------- AUTH ----------
from auth import make_auth_blueprint
auth_bp, require_auth, require_role = make_auth_blueprint(db, jwt_secret=JWT_SECRET)
app.register_blueprint(auth_bp) 

# ---------- HELPERS ----------
def _as_oid(s):
    try:
        return ObjectId(s)
    except Exception:
        return None

def _exam_summary(d: dict):
    has_key = bool(d.get("answer_key")) and len(d["answer_key"]) > 0
    return {
        "_id": str(d["_id"]),
        "title": d.get("title") or "Untitled exam",
        "hasKey": has_key,
        "status": "published" if has_key else "draft",
        "pagesCount": len(d.get("pages") or []),
        "submissionsCount": (d.get("stats") or {}).get("submissions", 0),
        "createdBy": str(d.get("created_by")) if d.get("created_by") else None,
        "createdAt": d.get("created_at").isoformat() + "Z" if d.get("created_at") else None,
    }

# ---------- ROUTES ----------
@app.get("/health")
def health():
    return jsonify({"ok": True})

@app.post("/api/exams")
@require_auth
def api_create_exam():
    j = request.get_json(silent=True) or {}
    title = (j.get("title") or "").strip() or "Untitled exam"
    answer_key = j.get("answer_key") or []
    pages = j.get("pages") or []

    owner_oid = _as_oid(g.user.get("sub"))
    if not owner_oid:
        return jsonify({"error": "invalid user id"}), 400

    doc = {
        "title": title,
        "answer_key": answer_key,
        "pages": pages,
        "created_by": owner_oid,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "stats": {"submissions": 0},
    }
    ins = exams.insert_one(doc)
    doc["_id"] = ins.inserted_id
    return jsonify(_exam_summary(doc)), 201

@app.get("/api/exams")
@require_auth
def api_list_exams():
    proj = {"title": 1, "answer_key": 1, "pages": 1, "stats": 1, "created_by": 1, "created_at": 1}
    if g.user.get("role") == "admin":
        q = {}
    else:
        user_oid = _as_oid(g.user.get("sub"))
        user_str = g.user.get("sub")
        q = {
            "$or": [
                {"created_by": user_oid},
                {"created_by": user_str},
                {"created_by": {"$exists": False}},
            ]
        }
    docs = list(exams.find(q, proj).sort([("created_at", -1), ("_id", -1)]))
    return jsonify([_exam_summary(d) for d in docs]), 200

@app.get("/ListExams")
@require_auth
def list_exams():
    return api_list_exams()

@app.get("/api/exams/<eid>")
@require_auth
def api_get_exam(eid):
    oid = _as_oid(eid)
    if not oid:
        return jsonify({"error": "invalid id"}), 400
    doc = exams.find_one({"_id": oid}, {"title": 1, "created_by": 1})
    if not doc:
        return jsonify({"error": "not found"}), 404
    if g.user.get("role") != "admin":
        owner_ok = (
            doc.get("created_by") == _as_oid(g.user.get("sub"))
            or str(doc.get("created_by") or "") == g.user.get("sub")
            or doc.get("created_by") is None
        )
        if not owner_ok:
            return jsonify({"error": "forbidden"}), 403
    return jsonify({"_id": str(doc["_id"]), "title": doc.get("title")}), 200

# ---------- DASHBOARD ----------
def _start_of_week(d: datetime) -> datetime:
    monday = d - timedelta(days=d.weekday())
    return monday.replace(hour=0, minute=0, second=0, microsecond=0)

@app.get("/api/dashboard/summary")
@require_auth
def api_dashboard_summary():
    exam_id = request.args.get("examId")
    match = {}
    if exam_id:
        oid = _as_oid(exam_id)
        if not oid:
            return jsonify({"error": "invalid examId"}), 400
        match["examId"] = oid

    exams_count = exams.count_documents({})
    subs_count = submissions.count_documents(match)
    corrected_count = submissions.count_documents({**match, "corrected": True})
    avg_grade = 0.0

    avg_cursor = submissions.aggregate([
        {"$match": {**match, "grade": {"$ne": None}}},
        {"$group": {"_id": None, "avg": {"$avg": "$grade"}}}
    ])
    avg_doc = next(avg_cursor, None)
    if avg_doc:
        avg_grade = float(avg_doc.get("avg", 0.0))

    buckets = {"0": 0, "4": 0, "8": 0, "12": 0, "16": 0}
    for row in submissions.aggregate([
        {"$match": {**match, "grade": {"$ne": None}}},
        {"$bucket": {
            "groupBy": "$grade",
            "boundaries": [0, 4, 8, 12, 16, 20.000001],
            "default": "other",
            "output": {"count": {"$sum": 1}}
        }}
    ]):
        key = str(row["_id"])
        if key in buckets:
            buckets[key] = row["count"]

    grade_distribution = [
        {"bucket": "0–4", "count": buckets["0"]},
        {"bucket": "4–8", "count": buckets["4"]},
        {"bucket": "8–12", "count": buckets["8"]},
        {"bucket": "12–16", "count": buckets["12"]},
        {"bucket": "16–20", "count": buckets["16"]},
    ]

    sow = _start_of_week(datetime.utcnow())
    week_counts = {i: 0 for i in range(1, 8)}
    for row in submissions.aggregate([
        {"$match": {**match, "created_at": {"$gte": sow}}},
        {"$group": {"_id": {"$dayOfWeek": "$created_at"}, "count": {"$sum": 1}}},
    ]):
        week_counts[row["_id"]] = row["count"]

    dow_map = {"Sun": 1, "Mon": 2, "Tue": 3, "Wed": 4, "Thu": 5, "Fri": 6, "Sat": 7}
    submissions_over_time = [
        {"date": d, "count": week_counts[dow_map[d]]}
        for d in ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    ]

    pending = max(subs_count - corrected_count, 0)
    correction_status = [
        {"name": "Corrected", "value": corrected_count},
        {"name": "Pending", "value": pending},
    ]

    time_saved = []
    time_pipeline = [
        {"$match": {**match, "aiTimeHours": {"$ne": None}, "manualTimeHours": {"$ne": None}}},
        {"$group": {
            "_id": {"year": {"$year": "$created_at"}, "week": {"$week": "$created_at"}},
            "ai": {"$avg": "$aiTimeHours"},
            "manual": {"$avg": "$manualTimeHours"},
        }},
        {"$sort": {"_id.year": -1, "_id.week": -1}},
        {"$limit": 4},
        {"$sort": {"_id.year": 1, "_id.week": 1}},
    ]
    for idx, row in enumerate(submissions.aggregate(time_pipeline), start=1):
        time_saved.append({
            "date": f"Week {idx}",
            "ai": round(float(row.get("ai") or 0), 2),
            "manual": round(float(row.get("manual") or 0), 2),
        })

    top_students = []
    for row in submissions.aggregate([
        {"$match": {**match, "grade": {"$ne": None}}},
        {"$group": {"_id": "$studentId", "grade": {"$avg": "$grade"}}},
        {"$sort": {"grade": -1}},
        {"$limit": 5},
    ]):
        sid = str(row["_id"]) if row["_id"] else "Student"
        top_students.append({"name": sid[:12], "grade": round(float(row["grade"]), 1)})

    return jsonify({
        "kpis": {
            "exams": exams_count,
            "submissions": subs_count,
            "corrected": corrected_count,
            "avgGrade": round(avg_grade, 1),
            "deltas": {"exams": 2, "submissions": 41, "corrected": 23, "avgGrade": 0.4},
        },
        "correctionStatus": correction_status,
        "gradeDistribution": grade_distribution,
        "submissionsOverTime": submissions_over_time,
        "timeSaved": time_saved,
        "topStudents": top_students,
    }), 200

if __name__ == "__main__":
    port = int(os.getenv("PORT", "5006"))
    app.run(host="0.0.0.0", port=port, debug=True)