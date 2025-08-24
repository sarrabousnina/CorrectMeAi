# auth.py
import time, functools
from datetime import datetime
from flask import Blueprint, request, jsonify, g
from pymongo.errors import DuplicateKeyError
from flask_cors import cross_origin
import jwt, bcrypt
import config

def _now(): return datetime.utcnow()

def _hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def _check_pw(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

def _issue_jwt(user: dict) -> str:
    payload = {
        "sub": str(user["_id"]),
        "email": user.get("email"),
        "name": user.get("name"),
        "role": user.get("role", "instructor"),
        "iat": int(time.time()),
        "exp": int(time.time() + config.JWT_TTL_HRS * 3600),
    }
    return jwt.encode(payload, config.JWT_SECRET, algorithm="HS256")

def _decode_jwt(token: str) -> dict:
    return jwt.decode(token, config.JWT_SECRET, algorithms=["HS256"])

def _bearer():
    h = request.headers.get("Authorization") or ""
    return h.split(" ", 1)[1].strip() if h.lower().startswith("bearer ") else None

# -------- decorators --------
def require_auth(fn):
    @functools.wraps(fn)
    def wrapper(*a, **kw):
        tok = _bearer()
        if not tok:
            return jsonify({"error": "missing auth token"}), 401
        try:
            g.user = _decode_jwt(tok)
        except Exception:
            return jsonify({"error": "invalid/expired token"}), 401
        return fn(*a, **kw)
    return wrapper

def require_role(*roles):
    def deco(fn):
        @functools.wraps(fn)
        def wrapper(*a, **kw):
            tok = _bearer()
            if not tok:
                return jsonify({"error": "missing auth token"}), 401
            try:
                data = _decode_jwt(tok)
            except Exception:
                return jsonify({"error": "invalid/expired token"}), 401
            if data.get("role") not in roles:
                return jsonify({"error": "forbidden", "need": roles}), 403
            g.user = data
            return fn(*a, **kw)
        return wrapper
    return deco

# -------- blueprint --------
def make_auth_blueprint(db):
    users = db["users"]
    users.create_index("email", unique=True)

    bp = Blueprint("auth", __name__)

    # Allowed origin(s) for the frontend dev server
    ALLOWED_ORIGINS = ["http://localhost:3000"]

    def _cors_args():
        return dict(
            origins=ALLOWED_ORIGINS,
            supports_credentials=False,
            methods=["GET", "POST", "OPTIONS"],
            allow_headers=["Content-Type", "Authorization"],
            max_age=86400,
        )

    @bp.route("/api/auth/register", methods=["POST", "OPTIONS"])
    @cross_origin(**_cors_args())
    def register():
        # CORS preflight
        if request.method == "OPTIONS":
            return ("", 204)

        """
        Bootstrap rule:
        - If no users exist yet: open registration (you can create the first admin).
        - If users exist: ONLY an admin (Bearer token) can create more users.
        """
        j = request.get_json(silent=True) or {}
        email = (j.get("email") or "").strip().lower()
        password = j.get("password") or ""
        name = (j.get("name") or "").strip() or email.split("@")[0]
        role = (j.get("role") or "instructor").strip()

        if not email or not password:
            return jsonify({"error": "email and password required"}), 400

        if users.count_documents({}) > 0:
            tok = _bearer()
            if not tok:
                return jsonify({"error": "admin auth required"}), 401
            try:
                data = _decode_jwt(tok)
            except Exception:
                return jsonify({"error": "invalid token"}), 401
            if data.get("role") != "admin":
                return jsonify({"error": "admin role required"}), 403

        doc = {
            "email": email,
            "name": name,
            "password_hash": _hash_pw(password),
            "role": role if role in ("admin", "instructor", "student") else "instructor",
            "created_at": _now(),
        }
        try:
            ins = users.insert_one(doc)
        except DuplicateKeyError:
            return jsonify({"error": "email already exists"}), 409

        doc["_id"] = ins.inserted_id
        token = _issue_jwt(doc)
        return jsonify({
            "token": token,
            "user": {"id": str(doc["_id"]), "email": email, "name": name, "role": doc["role"]},
        }), 201

    @bp.route("/api/auth/login", methods=["POST", "OPTIONS"])
    @cross_origin(**_cors_args())
    def login():
        # CORS preflight
        if request.method == "OPTIONS":
            return ("", 204)

        j = request.get_json(silent=True) or {}
        email = (j.get("email") or "").strip().lower()
        password = j.get("password") or ""
        if not email or not password:
            return jsonify({"error": "email and password required"}), 400
        u = users.find_one({"email": email})
        if not u or not _check_pw(password, u.get("password_hash", "")):
            return jsonify({"error": "invalid credentials"}), 401
        token = _issue_jwt(u)
        return jsonify({
            "token": token,
            "user": {"id": str(u["_id"]), "email": u["email"], "name": u.get("name"), "role": u.get("role", "instructor")},
        }), 200

    @bp.route("/api/me", methods=["GET", "OPTIONS"])
    @cross_origin(**_cors_args())
    @require_auth
    def me():
        if request.method == "OPTIONS":
            return ("", 204)
        return jsonify({"user": g.user}), 200

    return bp, require_auth, require_role
