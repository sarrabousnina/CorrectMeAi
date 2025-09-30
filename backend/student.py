import os
import base64
import json
import re
import requests
from datetime import datetime
from bson import ObjectId
from bson.errors import InvalidId
from flask import Flask, request, jsonify
from flask_cors import CORS

# DB collections
from mongo import exams_collection, submissions_collection

# Auth config (use the same secret as your main backend)
import jwt
import config  # must contain JWT_SECRET

app = Flask(__name__)
CORS(app)

# ================================
# Config (env with fallback)
# ================================
TOGETHER_API_KEY = os.getenv("TOGETHER_API_KEY", "3e69abd7b145cb5c9e490f67e94559e312d35c251bdf8ef03f009fc76016a9c9")
TOGETHER_ENDPOINT = "https://api.together.xyz/v1/chat/completions"
TOGETHER_MODEL = "meta-llama/Llama-4-Scout-17B-16E-Instruct"

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "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")
OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_MODEL = "qwen/qwen2-72b-instruct"

# ---------- auth helpers ----------
def _bearer():
    h = request.headers.get("Authorization") or ""
    return h.split(" ", 1)[1].strip() if h.lower().startswith("bearer ") else None

def _decode_jwt(tok):
    return jwt.decode(tok, config.JWT_SECRET, algorithms=["HS256"])

def _user_or_none():
    tok = _bearer()
    if not tok:
        return None
    try:
        return _decode_jwt(tok)
    except Exception:
        return None

# ================================
# Normalization helpers
# ================================
def _flatten_value(v):
    if v is None: return ""
    if isinstance(v, (int, float, bool)): return str(v)
    if isinstance(v, list): return " ".join(_flatten_value(x) for x in v).strip()
    if isinstance(v, dict): return " ".join(_flatten_value(v[k]) for k in sorted(v.keys())).strip()
    s = str(v).strip()
    m = re.match(r"^[a-d]\b", s, flags=re.IGNORECASE)  # MCQ "D - polite request" -> "d"
    return m.group(0).lower() if m else s

def _normalize_answers_structured(ans):
    if not isinstance(ans, dict):
        return {"Q1": _flatten_value(ans)}
    items = list(ans.items())
    tmp = {}
    for i, (k, v) in enumerate(items, 1):
        key = (k or "").strip().lower() if isinstance(k, str) else ""
        if not re.match(r"^(q?\d+)$", key):
            key = f"q{i}"
        idx = int(re.sub(r"[^0-9]", "", key) or i)
        tmp[idx] = _flatten_value(v)
    canon = {}
    for i in sorted(tmp.keys()):
        canon[f"Q{i}"] = tmp[i]
    return canon

def _extract_first_json(text: str) -> str:
    if not text:
        raise json.JSONDecodeError("empty response", "", 0)
    m = re.search(r"```json\s*(\{.*?\})\s*```", text, re.DOTALL | re.IGNORECASE)
    if m: return m.group(1)
    m2 = re.search(r"\{.*\}", text, re.DOTALL)
    if not m2: raise json.JSONDecodeError("no JSON object found", text, 0)
    return m2.group(0)

def normalize_answer_keep_articles(v):
    if isinstance(v, dict): v = " ".join(str(x) for x in v.values())
    elif isinstance(v, list): v = " ".join(str(x) for x in v)
    elif v is None: return ""
    s = str(v).lower()
    s = re.sub(r"[^\w\s']+", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s

def _clean_student_name(s: str) -> str:
    """Normalize a name string; if it’s only digits, return as-is (we will treat it as number)."""
    s = (s or "").strip()
    s = re.sub(r"\s+", " ", s)
    s = re.sub(r"^[\W_]+|[\W_]+$", "", s)
    if s and not re.fullmatch(r"\d+", s):
        s = s.title()
    return s

# ================================
# Routes
# ================================
@app.route("/extract-answers", methods=["POST"])
def extract_answers():
    if "files" not in request.files:
        return jsonify({"error": "No image file provided"}), 400

    image = request.files["files"]
    image_bytes = image.read()
    image_base64 = base64.b64encode(image_bytes).decode("utf-8")

    system = (
        "You extract the student's NAME and answers from an exam photo.\n"
        "Return STRICT JSON ONLY (no prose, no code fences).\n"
        "Schema:\n"
        "{\n"
        '  "student_name": string,          // full human name exactly as on the paper\n'
        '  "student_number": string|null,   // small numeric seat/roll number if present, else null\n'
        '  "answers_structured": { "Q1": string, "Q2": string, ... }\n'
        "}\n"
        "Rules:\n"
        "- If a question has multiple blanks/parts, combine them into ONE string, in order (e.g., 'plane ticket seems').\n"
        "- For multiple-choice, return only the option letter a/b/c/d (lowercase).\n"
        "- Number questions sequentially Q1, Q2, ... in the order they appear.\n"
        "- Use empty string if a question is blank/unclear.\n"
        "- IMPORTANT: 'student_name' must be the person's name (e.g., 'Sarra Boumika'), "
        "not the numeric seat number like '13'. Put that numeric value into 'student_number'.\n"
    )

    user_content = [
        {"type": "text", "text": "Extract student_name, student_number and answers_structured from this exam image."},
        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_base64}" }},
    ]

    payload = {
        "model": TOGETHER_MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user_content},
        ],
        "temperature": 0.1,
        "max_tokens": 800,
        "top_p": 0.8,
    }

    headers = {
        "Authorization": f"Bearer {TOGETHER_API_KEY}",
        "Content-Type": "application/json",
    }

    try:
        r = requests.post(TOGETHER_ENDPOINT, headers=headers, json=payload, timeout=60)
        r.raise_for_status()
        raw = r.json()["choices"][0]["message"]["content"].strip()

        raw_json = _extract_first_json(raw)
        data = json.loads(raw_json)

        # Prefer proper name; keep number separately
        name_from_model = _clean_student_name(
            data.get("student_name") or data.get("student_id") or data.get("name") or data.get("student") or ""
        )
        number_from_model = (data.get("student_number") or "").strip()

        # If the 'name' the model returned is actually just digits, treat it as the number and try to find a real name
        if not name_from_model or re.fullmatch(r"\d+", name_from_model):
            if not number_from_model:
                number_from_model = (data.get("student_id") or "").strip()
            name_from_model = "Unknown Student"

        answers_raw = data.get("answers_structured") or data.get("answers") or {}
        answers_structured = _normalize_answers_structured(answers_raw)

        # Back-compat: return 'student_id' as the NAME
        return jsonify({
            "student_id": name_from_model,         # legacy field – now the NAME
            "student_name": name_from_model,       # explicit
            "student_number": number_from_model or None,
            "answers_structured": answers_structured
        }), 200

    except (json.JSONDecodeError, KeyError) as e:
        return jsonify({"error": f"Failed to parse model JSON: {e}", "raw": raw if 'raw' in locals() else ""}), 500
    except requests.exceptions.RequestException as e:
        return jsonify({"error": str(e)}), 502

# --- helper: my latest exam (uses JWT) ---
@app.get("/api/my-latest-exam")
def my_latest_exam():
    user = _user_or_none()
    if not user:
        return jsonify({"error": "missing/invalid auth token"}), 401
    owner = ObjectId(user["sub"])
    doc = exams_collection.find_one({"created_by": owner}, sort=[("created_at", -1), ("_id", -1)])
    if not doc:
        return jsonify({"error": "no exams found for user"}), 404
    return jsonify({"_id": str(doc["_id"]), "title": doc.get("title", "Untitled Exam")})

@app.route("/api/submit-student", methods=["POST"])
def submit_student():
    """
    Save a student submission and link it to an exam.
    Preferred: client sends exam_id.
    Fallback: if exam_id is missing or 'latest', we attach to the latest exam created by the signed-in user.
    """
    user = _user_or_none()  # instructor/admin
    data = request.json or {}

    # Accept either student_id (legacy) or student_name (new)
    student_name = (data.get("student_name") or data.get("student_id") or "").strip()
    answers_in = data.get("answers_structured")

    if not student_name or not answers_in:
        return jsonify({"error": "Missing student name or answers_structured"}), 400

    # Resolve exam to attach to
    exam_id = (data.get("exam_id") or "").strip()
    exam_doc = None

    if exam_id and exam_id.lower() != "latest":
        try:
            exam_oid = ObjectId(exam_id)
        except InvalidId:
            return jsonify({"error": "Invalid exam_id"}), 400
        exam_doc = exams_collection.find_one({"_id": exam_oid})
        if not exam_doc:
            return jsonify({"error": "Exam not found"}), 404

        # If we know the user, enforce ownership unless admin
        if user and user.get("role") != "admin":
            if str(exam_doc.get("created_by") or "") != user["sub"]:
                return jsonify({"error": "forbidden: exam belongs to another user"}), 403
    else:
        # No exam_id provided or "latest" -> require auth to pick the user's latest exam
        if not user:
            return jsonify({"error": "exam_id missing; provide it or sign in so we can use your latest exam"}), 401
        owner = ObjectId(user["sub"])
        exam_doc = exams_collection.find_one({"created_by": owner}, sort=[("created_at", -1), ("_id", -1)])
        if not exam_doc:
            return jsonify({"error": "No exams found for this user"}), 404

    # Normalize answers and insert submission
    answers_structured = _normalize_answers_structured(answers_in)

    ins = submissions_collection.insert_one({
        "student_id": student_name,                          # keep field name for compatibility (now stores NAME)
        "student_name": student_name,                        # explicit
        "student_number": (data.get("student_number") or "").strip() or None,
        "exam_id": exam_doc["_id"],
        "answers_structured": answers_structured,
        "score": None,
        "feedback": None,
        "created_at": datetime.utcnow(),
    })

    # Increment exam stats
    exams_collection.update_one(
        {"_id": exam_doc["_id"]},
        {"$inc": {"stats.submissions": 1}, "$set": {"updated_at": datetime.utcnow()}},
    )

    return jsonify({
        "message": "✅ Submission saved",
        "submission_id": str(ins.inserted_id),
        "exam_id": str(exam_doc["_id"]),
        "exam_title": exam_doc.get("title", "Untitled Exam"),
    }), 201

@app.route("/api/score-submission/<submission_id>", methods=["POST"])
def score_submission(submission_id):
    try:
        object_id = ObjectId(submission_id)
    except InvalidId:
        return jsonify({"error": "Invalid submission ID"}), 400

    submission = submissions_collection.find_one({"_id": object_id})
    if not submission:
        return jsonify({"error": "Submission not found"}), 404

    exam = exams_collection.find_one({"_id": submission["exam_id"]})
    if not exam:
        return jsonify({"error": "Exam not found"}), 404

    try:
        answer_key = exam["answer_key"]
        student_answers = submission["answers_structured"]
    except KeyError:
        return jsonify({"error": "Missing answer_key or answers_structured"}), 500

    student_answers = _normalize_answers_structured(student_answers)
    student_answers_for_grading = {k: normalize_answer_keep_articles(v) for k, v in student_answers.items()}

    prompt = (
        "You are a teacher assistant AI.\n\n"
        f"Exam Answer Key:\n{json.dumps(answer_key, indent=2)}\n\n"
        f"Student Submission:\n{json.dumps(student_answers_for_grading, indent=2)}\n\n"
        "Compare the answers and grade them out of 20.\n"
        "Explain what is correct and what is wrong.\n"
        'Return only this JSON: { "score": number, "feedback": string }'
    )

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
    }

    try:
        response = requests.post(
            OPENROUTER_ENDPOINT,
            headers=headers,
            json={"model": OPENROUTER_MODEL, "messages": [{"role": "user", "content": prompt}], "temperature": 0.2},
            timeout=60,
        )
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]

        m = re.search(r"\{.*\}", content, re.DOTALL)
        if not m:
            raise ValueError("Model response does not contain valid JSON")
        result = json.loads(m.group(0))

        submissions_collection.update_one(
            {"_id": object_id},
            {"$set": {"score": result.get("score"), "feedback": result.get("feedback")}},
        )

        return jsonify(result)

    except Exception as e:
        return jsonify({"error": str(e), "raw": response.text if 'response' in locals() else ""}), 500

# Keep for compatibility (not strictly needed if the main backend lists exams)
@app.route("/api/exams/latest", methods=["GET"])
def get_latest_exam():
    try:
        latest_exam = exams_collection.find_one(sort=[("_id", -1)])
        if latest_exam:
            return jsonify({"id": str(latest_exam["_id"]), "title": latest_exam.get("title", "Untitled Exam")}), 200
        else:
            return jsonify({"error": "No exams found."}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True, port=5001)
