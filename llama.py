import os
import base64
import requests
from mongo import exams_collection
from flask import Flask, request, jsonify
from flask_cors import CORS

# === CONFIGURATION ===
TOGETHER_API_KEY = "3e69abd7b145cb5c9e490f67e94559e312d35c251bdf8ef03f009fc76016a9c9"
TOGETHER_ENDPOINT = "https://api.together.xyz/v1/chat/completions"
MODEL_NAME = "meta-llama/Llama-4-Scout-17B-16E-Instruct"

# === Flask App Setup ===
app = Flask(__name__)
CORS(app)  # Enable CORS for React frontend

def extract_text_from_image(image_bytes):
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

    response = requests.post(TOGETHER_ENDPOINT, headers=headers, json=payload)
    response.raise_for_status()
    result = response.json()
    return result["choices"][0]["message"]["content"]


@app.route("/extract", methods=["POST"])
def extract_text():
    if 'files' not in request.files:
        return jsonify({"error": "No files part in the request"}), 400

    uploaded_files = request.files.getlist("files")
    if not uploaded_files or all(f.filename == '' for f in uploaded_files):
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
    
@app.route("/api/submit-answer-key", methods=["POST"])
def submit_answer_key():
    data = request.json

    if not data.get("title") or not data.get("answer_key"):
        return jsonify({"error": "Missing title or answer_key"}), 400

    # Optional: Add created_by, date, etc.
    result = exams_collection.insert_one(data)

    return jsonify({
        "message": "✅ Correction key saved!",
        "exam_id": str(result.inserted_id)
    })



if __name__ == "__main__":
    app.run(debug=True)
