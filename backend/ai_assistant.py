import os
import json
import time
from datetime import datetime
from bson import ObjectId
from flask import Blueprint, request, jsonify, g
from flask_cors import cross_origin
import jwt
import numpy as np
from sentence_transformers import SentenceTransformer
from dotenv import load_dotenv
from groq import Groq 
from werkzeug.utils import secure_filename

load_dotenv()

# DB
from mongo import exams_collection, submissions_collection, courses_collection  # ← NEW: Add courses collection

# Config
JWT_SECRET = os.getenv("JWT_SECRET")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

if not all([JWT_SECRET, GROQ_API_KEY]):
    raise RuntimeError("Missing required env vars: JWT_SECRET, GROQ_API_KEY")

# Groq client
groq_client = Groq(api_key=GROQ_API_KEY)

# Use a fast, free Groq model
GROQ_MODEL = "llama-3.1-8b-instant"

# Embedding model
EMBEDDING_MODEL = SentenceTransformer("all-MiniLM-L6-v2")

# Memory store
SESSION_MEMORY = {}

# Upload config
UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

bp_ai = Blueprint("ai", __name__)

# ---------- Auth ----------
def _decode_jwt(token: str) -> dict:
    return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])

def _require_auth():
    h = request.headers.get("Authorization") or ""
    token = h.split(" ", 1)[1].strip() if h.lower().startswith("bearer ") else None
    if not token:
        return None, jsonify({"error": "missing auth token"}), 401
    try:
        user = _decode_jwt(token)
        g.user = user
        return user, None, None
    except Exception:
        return None, jsonify({"error": "invalid token"}), 401

# ---------- TOOLS ----------
def tool_list_exams(user_id):
    """List exams owned by user"""
    try:
        exams = list(exams_collection.find(
            {"created_by": ObjectId(user_id)},
            {"title": 1, "created_at": 1}
        ).sort([("created_at", -1)]))
        
        if not exams:
            return "No exams found."
            
        result = []
        for exam in exams:
            result.append({
                "id": str(exam["_id"]),
                "title": exam.get("title", "Untitled Exam"),
                "created_at": exam.get("created_at").isoformat() if exam.get("created_at") else "Unknown"
            })
        return json.dumps(result, ensure_ascii=False)
    except Exception as e:
        return f"Error listing exams: {str(e)}"

def tool_get_exam(exam_id):
    """Get exam details"""
    try:
        if not exam_id:
            return "Exam ID is required."
            
        exam = exams_collection.find_one({"_id": ObjectId(exam_id)})
        if not exam:
            return "Exam not found."
            
        return json.dumps({
            "id": str(exam["_id"]),
            "title": exam.get("title", "Untitled Exam"),
            "answer_key": exam.get("answer_key", []),
            "pages_count": len(exam.get("pages", [])),
            "created_at": exam.get("created_at").isoformat() if exam.get("created_at") else "Unknown",
            "created_by": str(exam.get("created_by")) if exam.get("created_by") else "Unknown"
        }, ensure_ascii=False)
    except Exception as e:
        return f"Error getting exam: {str(e)}"

def tool_list_submissions(exam_id=None):
    """List submissions for an exam"""
    try:
        if not exam_id:
            latest = exams_collection.find_one(sort=[("created_at", -1)])
            if not latest:
                return "No exams found to list submissions for."
            exam_id = str(latest["_id"])
            
        subs = list(submissions_collection.find(
            {"exam_id": ObjectId(exam_id)}
        ).sort([("created_at", -1)]))
        
        if not subs:
            return "No submissions found for this exam."
            
        result = []
        for s in subs:
            result.append({
                "id": str(s["_id"]),
                "student": s.get("student_name", "Unknown Student"),
                "score": s.get("score", "N/A"),
                "feedback": s.get("feedback", "")[:100] + ("..." if len(s.get("feedback", "")) > 100 else ""),
                "created_at": s.get("created_at").isoformat() if s.get("created_at") else "Unknown"
            })
        return json.dumps(result, ensure_ascii=False)
    except Exception as e:
        return f"Error listing submissions: {str(e)}"

# ---------- RAG TOOL ----------
def tool_search_rag(query: str, user_id: str) -> str:
    """Search RAG index for relevant context"""
    try:
        docs = []
        courses = courses_collection.find({"user_id": ObjectId(user_id)})
        
        for course in courses:
            content = course.get("text", "")
            if not content.strip():
                continue
            embedding = EMBEDDING_MODEL.encode(content).tolist()
            docs.append({
                "content": content,
                "course_id": str(course["_id"]),
                "embedding": embedding,
                "type": "course_material",
                "name": course.get("name", "Unnamed Course")
            })

        if not docs:
            return "No course material found. Please upload some PDFs first."

        query_vec = EMBEDDING_MODEL.encode(query)
        similarities = []
        for doc in docs:
            doc_vec = np.array(doc["embedding"])
            sim = np.dot(query_vec, doc_vec) / (np.linalg.norm(query_vec) * np.linalg.norm(doc_vec))
            similarities.append((sim, doc["content"], doc["name"]))
        
        similarities.sort(key=lambda x: x[0], reverse=True)
        top_docs = [f"📄 From '{name}':\n{content}" for _, content, name in similarities[:3]]
        return "\n\n".join(top_docs)
    except Exception as e:
        return f"Error searching RAG: {str(e)}"

# ---------- ReAct AGENT ----------
def run_react_agent(user_query, user_id, session_id):
    history = SESSION_MEMORY.get(session_id, [])
    chat_history_lines = []
    for h in history[-2:]:
        line = f"User: {h['query']}"
        if h.get('response'):
            line += f"\nAssistant: {h['response']}"
        chat_history_lines.append(line)
    chat_history_str = "\n".join(chat_history_lines)

    system_prompt = f"""
You are ProfMate, an AI teaching assistant. Use the following tools to answer questions:

TOOL SPECS:
- list_exams(): Returns [{{"id": str, "title": str, "created_at": str}}]
- get_exam(exam_id: str): Returns exam details including title, answer key, pages count
- list_submissions(exam_id: str = None): Returns [{{"id": str, "student": str, "score": float, "feedback": str}}]
- search_rag(query: str): Searches uploaded course material for relevant context

RULES:
1. First, think step by step (Thought).
2. If you need data, call ONE tool in JSON format ONLY: {{"tool": "tool_name", "args": {{...}}}}
3. Do NOT add any other text before or after the JSON.
4. If no tool is needed, answer directly.
5. When returning tool results, make them human-readable and concise.

CHAT HISTORY:
{chat_history_str}
""".strip()

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_query},
    ]

    try:
        response = groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=messages,
            temperature=0.0,
            max_tokens=200,
        )
        first_response = response.choices[0].message.content.strip()
    except Exception as e:
        raise Exception(f"Groq error (step 1): {str(e)}")

    # Extract JSON from response (handle cases where LLM adds text)
    tool_call = None
    try:
        # Find JSON object in the response
        import re
        json_match = re.search(r'\{.*\}', first_response, re.DOTALL)
        if json_match:
            tool_call = json.loads(json_match.group())
    except Exception as e:
        print(f"JSON parsing error: {e}")
        pass

    final_answer = ""
    if tool_call and "tool" in tool_call:
        tool_name = tool_call["tool"]
        args = tool_call.get("args", {})
        observation = "Tool execution failed."
        
        try:
            if tool_name == "list_exams":
                observation = tool_list_exams(user_id)
            elif tool_name == "get_exam":
                exam_id = args.get("exam_id")
                if exam_id:
                    observation = tool_get_exam(exam_id)
                else:
                    observation = "Missing exam_id argument."
            elif tool_name == "list_submissions":
                exam_id = args.get("exam_id")
                observation = tool_list_submissions(exam_id)
            elif tool_name == "search_rag":
                query = args.get("query", "")
                if query:
                    observation = tool_search_rag(query, user_id)
                else:
                    observation = "Missing query argument."
            else:
                observation = f"Unknown tool: {tool_name}"
        except Exception as e:
            observation = f"Error: {str(e)}"

        # Add tool call and observation to messages
        messages.append({"role": "assistant", "content": first_response})
        messages.append({"role": "user", "content": f"Observation: {observation}"})
        messages.append({"role": "user", "content": "Now give the final answer in a clear, concise, human-readable format."})

        try:
            response = groq_client.chat.completions.create(
                model=GROQ_MODEL,
                messages=messages,
                temperature=0.3,
                max_tokens=500,
            )
            final_answer = response.choices[0].message.content.strip()
        except Exception as e:
            raise Exception(f"Groq error (step 2): {str(e)}")

        SESSION_MEMORY[session_id] = history[-4:] + [{"query": user_query, "response": final_answer}]
    else:
        final_answer = first_response
        SESSION_MEMORY[session_id] = history[-4:] + [{"query": user_query, "response": final_answer}]

    return final_answer

# ---------- ROUTES ----------
@bp_ai.route("/agent", methods=["POST"])
@cross_origin()
def agent():
    user, err, code = _require_auth()
    if err:
        return err, code

    data = request.get_json()
    message = data.get("message", "").strip()
    session_id = data.get("session_id", "default")

    if not message:
        return jsonify({"error": "message is required"}), 400

    try:
        reply = run_react_agent(message, user["sub"], session_id)
        return jsonify({"handled": True, "reply": reply})
    except Exception as e:
        return jsonify({"handled": True, "reply": f"Agent error: {str(e)}"}), 500

@bp_ai.route("/upload-course", methods=["POST"])
@cross_origin()
def upload_course():
    user, err, code = _require_auth()
    if err:
        return err, code

    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    if file and file.filename.endswith('.pdf'):
        filename = secure_filename(file.filename)
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        file.save(filepath)

        # Read PDF content (you'll need to install pdfplumber or PyPDF2)
        try:
            import pdfplumber
            text = ""
            with pdfplumber.open(filepath) as pdf:
                for page in pdf.pages:
                    text += page.extract_text() + "\n"
        except ImportError:
            text = "PDF text extraction requires pdfplumber. Install with: pip install pdfplumber"

        # Save to MongoDB
        course_doc = {
            "user_id": ObjectId(user["sub"]),
            "name": filename,
            "text": text,
            "uploaded_at": datetime.utcnow(),
            "filepath": filepath
        }
        courses_collection.insert_one(course_doc)

        return jsonify({
            "message": f"File '{filename}' uploaded and processed successfully",
            "path": filepath,
            "chars": len(text)
        }), 200
    else:
        return jsonify({"error": "Only PDF files are allowed"}), 400

@bp_ai.route("/chat", methods=["POST"])
@cross_origin()
def chat():
    return jsonify({"error": "Use /ai/agent for agent interactions"}), 400