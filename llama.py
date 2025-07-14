import os
import base64
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS

# === CONFIGURATION ===
TOGETHER_API_KEY = "3e69abd7b145cb5c9e490f67e94559e312d35c251bdf8ef03f009fc76016a9c9"
TOGETHER_ENDPOINT = "https://api.together.xyz/v1/chat/completions"
MODEL_NAME = "meta-llama/Llama-4-Scout-17B-16E-Instruct"

# === Flask App Setup ===
app = Flask(__name__)
CORS(app)  # Enable CORS for React frontend

@app.route("/extract", methods=["POST"])
def extract_text():
    if 'file' not in request.files:
        return jsonify({"error": "No file part in the request"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    try:
        image_bytes = file.read()
        image_base64 = base64.b64encode(image_bytes).decode("utf-8")

        payload = {
            "model": MODEL_NAME,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are a helpful assistant that extracts handwritten answers from student exam images. "
                        "Please preserve the blank spaces (______) where students need to fill in answers. "
                        "If the answer is not clear or missing, leave a blank line or mark it as ______. "
                        "For multiple-choice questions, list the options and clearly mark the selected choice, "
                        "with more spacing between each option. "
                        "For fill-in-the-blank questions, leave a blank line and keep the answer placeholders. "
                        "Return the extracted text in a structured format, with questions and answers clearly separated. "
                        "Ensure there is sufficient spacing between each question and answer to make the text more readable. "
                        "Keep the format clean, adding line breaks and blank lines where necessary to ensure the result is easy to follow. "
                        "If there are sections or headings, make sure they are clearly separated from the questions and answers. "
                        "For questions, make sure they are bold to clearly distinguish them from the answers. "
                        "Use bullet points for clarity and keep answers aligned with their corresponding questions."
                    )
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": (
                                "Extract all the handwritten answers from this exam image, preserving placeholders (______) where "
                                "the student should provide answers. For multiple-choice questions, return the options and "
                                "mark the selected one clearly. For fill-in-the-blank questions, keep the blanks (______). "
                                "Ensure the output maintains the structure of the exam paper, including section headings, "
                                "subheadings, and bullet points."
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
            "max_tokens": 1000,
            "top_p": 0.8
        }

        headers = {
            "Authorization": f"Bearer {TOGETHER_API_KEY}",
            "Content-Type": "application/json"
        }

        response = requests.post(TOGETHER_ENDPOINT, headers=headers, json=payload)
        response.raise_for_status()
        result = response.json()
        content = result["choices"][0]["message"]["content"]

        return jsonify({"text": content})

    except requests.exceptions.RequestException as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True)
