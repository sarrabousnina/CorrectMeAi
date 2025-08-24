# app.py — MAIN BACKEND (auth + exams) on port 5006
import os
from datetime import datetime

from bson import ObjectId
from flask import Flask, jsonify, request, g
from flask_cors import CORS
from pymongo import MongoClient, DESCENDING

import config
from auth import make_auth_blueprint  # provides /api/auth/* and decorators

# ---------- DB ----------
MONGO_URI = os.getenv("MONGO_URI", config.MONGO_URI)
client = MongoClient(MONGO_URI)
db = client["exam_system"]
exams = db["exams"]
submissions = db["submissions"]
users = db["users"]

# Helpful indexes (safe if already exist)
users.create_index("email", unique=True)
exams.create_index([("created_at", DESCENDING), ("_id", DESCENDING)])

# ---------- APP / CORS ----------
app = Flask(__name__)

FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")
CORS(
    app,
    resources={
        r"/api/*": {"origins": [FRONTEND_ORIGIN]},
        r"/ListExams": {"origins": [FRONTEND_ORIGIN]},
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
@app.route("/ListExams", methods=["OPTIONS"])
def _preflight(_any=None):
    return ("", 200)

# ---------- AUTH ROUTES ----------
# Register the auth blueprint here (this server owns /api/auth/*)
auth_bp, require_auth, require_role = make_auth_blueprint(db)
app.register_blueprint(auth_bp)

# ---------- HELPERS ----------
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
        "createdAt": d.get("created_at").isoformat() if d.get("created_at") else None,
    }

# ---------- ROUTES (MAIN) ----------
@app.get("/health")
def health():
    return jsonify({"ok": True})

# Create an exam (stamps created_by = current user)
@app.post("/api/exams")
@require_auth
def api_create_exam():
    j = request.get_json(silent=True) or {}
    title = (j.get("title") or "").strip() or "Untitled exam"
    answer_key = j.get("answer_key") or []
    pages = j.get("pages") or []

    doc = {
        "title": title,
        "answer_key": answer_key,
        "pages": pages,
        "created_by": ObjectId(g.user["sub"]),
        "created_at": datetime.utcnow(),
        "stats": {"submissions": 0},
    }
    ins = exams.insert_one(doc)
    return jsonify({"id": str(ins.inserted_id)}), 201

# List exams filtered by connected user (admins see all)
@app.get("/api/exams")
@require_auth
def api_list_exams():
    proj = {"title": 1, "answer_key": 1, "pages": 1, "stats": 1, "created_by": 1, "created_at": 1}
    q = {}
    if g.user.get("role") != "admin":
        q["created_by"] = ObjectId(g.user["sub"])

    docs = list(exams.find(q, proj).sort([("created_at", -1), ("_id", -1)]))
    return jsonify([_exam_summary(d) for d in docs]), 200

# (Legacy) ListExams: same result as /api/exams, requires auth too
@app.get("/ListExams")
@require_auth
def list_exams():
    # Reuse the same logic as /api/exams
    proj = {"title": 1, "answer_key": 1, "pages": 1, "stats": 1, "created_by": 1, "created_at": 1}
    q = {}
    if g.user.get("role") != "admin":
        q["created_by"] = ObjectId(g.user["sub"])

    docs = list(exams.find(q, proj).sort([("created_at", -1), ("_id", -1)]))
    return jsonify([_exam_summary(d) for d in docs]), 200

# Minimal fetch of one exam
@app.get("/api/exams/<eid>")
@require_role("admin", "instructor")
def api_get_exam(eid):
    try:
        oid = ObjectId(eid)
    except Exception:
        return jsonify({"error": "invalid id"}), 400

    doc = exams.find_one({"_id": oid}, {"title": 1, "created_by": 1})
    if not doc:
        return jsonify({"error": "not found"}), 404

    # Non-admins can only see their own exams
    if g.user.get("role") != "admin" and str(doc.get("created_by")) != g.user["sub"]:
        return jsonify({"error": "forbidden"}), 403

    return jsonify({"_id": str(doc["_id"]), "title": doc.get("title")}), 200

if __name__ == "__main__":
    port = int(os.getenv("PORT", "5006"))
    app.run(host="0.0.0.0", port=port, debug=True)
