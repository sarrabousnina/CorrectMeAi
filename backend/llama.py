# llama.py — extraction + save answer key
import os
import base64
import requests
import jwt
from datetime import datetime
from bson import ObjectId
from mongo import exams_collection
from flask import Flask, request, jsonify
from flask_cors import CORS
import config  # JWT_SECRET for decoding the token

# === CONFIGURATION ===
# ⚠️ Hardcoded key (Option C). Replace the placeholder with YOUR real key.
# Do NOT commit real secrets to version control.
TOGETHER_API_KEY = "3e69abd7b145cb5c9e490f67e94559e312d35c251bdf8ef03f009fc76016a9c9"

TOGETHER_ENDPOINT = "https://api.together.xyz/v1/chat/completions"
MODEL_NAME = "meta-llama/Llama-4-Scout-17B-16E-Instruct"

# === Flask App Setup ===
app = Flask(__name__)
CORS(app)  # Enable CORS for React frontend

def _bearer():
    h = request.headers.get("Authorization") or ""
    return h.split(" ", 1)[1].strip() if h.lower().startswith("bearer ") else None

def _decode_jwt(token: str) -> dict:
    return jwt.decode(token, config.JWT_SECRET, algorithms=["HS256"])

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
    }

def extract_text_from_image(image_bytes):
    if not TOGETHER_API_KEY:
        raise RuntimeError("TOGETHER_API_KEY is not set (hardcoded empty).")

    image_base64 = base64.b64encode(image_bytes).decode("utf-8")

    payload = {
        "model": MODEL_NAME,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are a helpful assistant that extracts the full text from scanned exam sheets. "
                    "There are no student answers on the sheet — only questions, headers, and blanks. "
                    "Your job is to reconstruct the layout of the exam as clearly and structurally as possible. "
                    "Preserve blanks (______) for fill-in-the-blank questions. "
                    "For multiple choice questions (MCQs), show the available options (a, b, c, d) in list format. "
                    "Do NOT invent or mark any answer as selected. "
                    "Use clear section headers like 'I. LISTENING', 'II. LANGUAGE', etc. "
                    "Add line breaks between questions and indent answer options if needed. "
                    "Keep the output clean and readable, like a markdown-formatted test document."
                )
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": (
                            "Please extract the full text from this exam paper image. "
                            "Do not mark any answer as selected. Just extract the structure, "
                            "keeping blanks (______), multiple choice options, and section headers."
                        )
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{image_base64}"
                        }
                    }
                ]
            }
        ],
        "temperature": 0.2,
        "max_tokens": 2000,
        "top_p": 0.8
    }

    headers = {
        "Authorization": f"Bearer {TOGETHER_API_KEY}",
        "Content-Type": "application/json"
    }

    resp = requests.post(TOGETHER_ENDPOINT, headers=headers, json=payload, timeout=60)
    resp.raise_for_status()
    result = resp.json()
    return result["choices"][0]["message"]["content"]

@app.route("/extract", methods=["POST"])
def extract_text():
    if "files" not in request.files:
        return jsonify({"error": "No files part in the request"}), 400

    uploaded_files = request.files.getlist("files")
    if not uploaded_files or all(f.filename == "" for f in uploaded_files):
        return jsonify({"error": "No files selected"}), 400

    full_text = ""
    try:
        for idx, file in enumerate(uploaded_files):
            image_bytes = file.read()
            extracted = extract_text_from_image(image_bytes)
            full_text += f"🖼️ Page {idx + 1} ({file.filename})\n{extracted}\n\n"

        return jsonify({"text": full_text})
    except requests.exceptions.RequestException as e:
        return jsonify({"error": str(e)}), 500
    except RuntimeError as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/submit-answer-key", methods=["POST"])
def submit_answer_key():
    # Require auth, so we can stamp created_by
    tok = _bearer()
    if not tok:
        return jsonify({"error": "missing auth token"}), 401
    try:
        user = _decode_jwt(tok)
    except Exception:
        return jsonify({"error": "invalid/expired token"}), 401

    data = request.json or {}
    title = (data.get("title") or "").strip()
    answer_key = data.get("answer_key")

    if not title or not answer_key:
        return jsonify({"error": "Missing title or answer_key"}), 400

    owner_oid = ObjectId(user["sub"])

    doc = {
        "title": title,
        "answer_key": answer_key,
        "pages": data.get("pages") or [],
        "stats": {"submissions": 0},
        "created_by": owner_oid,          # 🔹 ownership
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }

    ins = exams_collection.insert_one(doc)
    doc["_id"] = ins.inserted_id

    return jsonify({
        "message": "✅ Correction key saved!",
        "exam": _exam_summary(doc)
    }), 201

if __name__ == "__main__":
    app.run(debug=True)
