import os
import base64
import json
import re
import requests
from bson import ObjectId
from bson.errors import InvalidId
from flask import Flask, request, jsonify
from werkzeug.utils import secure_filename
from flask_cors import CORS
from mongo import exams_collection, submissions_collection

app = Flask(__name__)
CORS(app)

# ✅ TOGETHER API SETTINGS
TOGETHER_API_KEY = "3e69abd7b145cb5c9e490f67e94559e312d35c251bdf8ef03f009fc76016a9c9"
TOGETHER_ENDPOINT = "https://api.together.xyz/v1/chat/completions"
TOGETHER_MODEL = "meta-llama/Llama-4-Scout-17B-16E-Instruct"

# ✅ OPENROUTER API SETTINGS
OPENROUTER_API_KEY = "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"
OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_MODEL = "qwen/qwen2-72b-instruct"


@app.route("/extract-answers", methods=["POST"])
def extract_answers():
    if 'files' not in request.files:
        return jsonify({"error": "No image file provided"}), 400

    image = request.files['files']
    image_bytes = image.read()
    image_base64 = base64.b64encode(image_bytes).decode("utf-8")

    payload = {
        "model": TOGETHER_MODEL,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are a helpful assistant that extracts handwritten answers from student exam images.\n"
                    "You MUST return both the student's name and answers as a JSON object.\n\n"
                    "Return JSON like:\n"
                    "{ \"student_name\": \"Ahmed Ben Salah\", \"answers\": { \"Q1\": \"B\", \"Q2\": \"Photosynthesis\" } }"
                )
            },
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Extract the student name and answers from this exam image."},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"}}
                ]
            }
        ],
        "temperature": 0.2,
        "max_tokens": 1000,
        "top_p": 0.8
    }

    headers = {
        "Authorization": f"Bearer {TOGETHER_API_KEY}",
        "Content-Type": "application/json"
    }

    try:
        response = requests.post(TOGETHER_ENDPOINT, headers=headers, json=payload)
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]

        match = re.search(r"\{.*\}", content, re.DOTALL)
        json_data = json.loads(match.group(0)) if match else {"answers": content.strip()}

        student_name = json_data.get("student_name", "Unknown Student")
        answers = json_data.get("answers", json_data)

        return jsonify({
            "student_name": student_name,
            "answers": answers
        })

    except requests.exceptions.RequestException as e:
        return jsonify({"error": str(e)}), 500
    except json.JSONDecodeError:
        return jsonify({"error": "Failed to parse model output as JSON", "raw": content}), 500


@app.route("/api/submit-student", methods=["POST"])
def submit_student():
    data = request.json
    if not data.get("student_id") or not data.get("exam_id") or not data.get("answers_structured"):
        return jsonify({"error": "Missing student_id, exam_id, or answers"}), 400

    result = submissions_collection.insert_one({
        "student_id": data["student_id"],
        "exam_id": ObjectId(data["exam_id"]),
        "answers_structured": data["answers_structured"],
        "score": None
    })

    return jsonify({"message": "✅ Submission saved", "submission_id": str(result.inserted_id)})


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

    prompt = (
        f"You are a teacher assistant AI.\n\n"
        f"Exam Answer Key:\n{json.dumps(answer_key, indent=2)}\n\n"
        f"Student Submission:\n{json.dumps(student_answers, indent=2)}\n\n"
        f"Compare the answers and grade them out of 20.\n"
        f"Explain what is correct and what is wrong.\n"
        f"Return only this JSON: {{ \"score\": number, \"feedback\": string }}"
    )

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json"
    }

    try:
        response = requests.post(
            OPENROUTER_ENDPOINT,
            headers=headers,
            json={
                "model": OPENROUTER_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.2
            }
        )
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]

        match = re.search(r"\{.*\}", content, re.DOTALL)
        if not match:
            raise ValueError("Model response does not contain valid JSON")

        result = json.loads(match.group(0))

        submissions_collection.update_one(
            {"_id": object_id},
            {"$set": {"score": result["score"], "feedback": result["feedback"]}}
        )

        return jsonify(result)

    except Exception as e:
        return jsonify({"error": str(e), "raw": response.text if 'response' in locals() else ""}), 500


@app.route("/api/exams/latest", methods=["GET"])
def get_latest_exam():
    try:
        latest_exam = exams_collection.find_one(sort=[("_id", -1)])
        if latest_exam:
            return jsonify({
                "id": str(latest_exam["_id"]),
                "title": latest_exam.get("title", "Untitled Exam")
            }), 200
        else:
            return jsonify({"error": "No exams found."}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5001)
