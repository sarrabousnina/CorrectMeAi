# ai_agent.py — Agent with RAG as a Tool
import os
import json
import re
from datetime import datetime
from bson import ObjectId
from flask import Blueprint, request, jsonify, g
from flask_cors import cross_origin
import jwt
import numpy as np
from sentence_transformers import SentenceTransformer
from dotenv import load_dotenv

load_dotenv()

# DB
from mongo import exams_collection, submissions_collection, course_materials_collection

# Config
JWT_SECRET = os.getenv("JWT_SECRET")
TOGETHER_API_KEY = os.getenv("TOGETHER_API_KEY")
TOGETHER_ENDPOINT = os.getenv("TOGETHER_ENDPOINT", "https://api.together.xyz/v1/chat/completions")
TOGETHER_MODEL = os.getenv("TOGETHER_MODEL", "meta-llama/Llama-3-8b-chat-hf")

if not all([JWT_SECRET, TOGETHER_API_KEY]):
    raise RuntimeError("Missing required env vars")

EMBEDDING_MODEL = SentenceTransformer("all-MiniLM-L6-v2")
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

# ---------- RAG: Store Course Material ----------
@bp_ai.route("/ai/upload-course", methods=["POST"])
@cross_origin()
def upload_course():
    user, err, code = _require_auth()
    if err:
        return err, code

    data = request.get_json()
    course_text = data.get("text", "").strip()
    course_name = data.get("name", "Untitled Course")

    if not course_text:
        return jsonify({"error": "Course text is required"}), 400

    # Simple chunking: split by paragraphs
    chunks = [chunk.strip() for chunk in re.split(r"\n\s*\n", course_text) if chunk.strip()]
    
    # Embed and store
    stored_chunks = []
    for i, chunk in enumerate(chunks):
        embedding = EMBEDDING_MODEL.encode(chunk).tolist()
        doc = {
            "user_id": ObjectId(user["sub"]),
            "course_name": course_name,
            "chunk_index": i,
            "text": chunk,
            "embedding": embedding,
            "created_at": datetime.utcnow(),
        }
        course_materials_collection.insert_one(doc)
        stored_chunks.append(doc)

    return jsonify({
        "message": f"✅ Uploaded {len(stored_chunks)} chunks for '{course_name}'",
        "chunks_count": len(stored_chunks)
    }), 201

# ---------- TOOLS ----------
def tool_list_exams(user_id):
    exams = list(exams_collection.find(
        {"created_by": ObjectId(user_id)},
        {"title": 1, "created_at": 1}
    ).sort([("created_at", -1)]))
    return [{"id": str(e["_id"]), "title": e["title"]} for e in exams]

def tool_get_exam(exam_id):
    exam = exams_collection.find_one({"_id": ObjectId(exam_id)})
    return exam if exam else None

def tool_list_submissions(exam_id=None):
    query = {"exam_id": ObjectId(exam_id)} if exam_id else {}
    subs = list(submissions_collection.find(query).sort([("created_at", -1)]))
    return [
        {
            "id": str(s["_id"]),
            "student": s.get("student_name", "Unknown"),
            "score": s.get("score"),
        }
        for s in subs
    ]

def tool_rag_search(query, user_id, top_k=3):
    """RAG as a tool: returns relevant course chunks"""
    chunks = list(course_materials_collection.find(
        {"user_id": ObjectId(user_id)},
        {"text": 1, "embedding": 1}
    ))
    
    if not chunks:
        return "No course material uploaded. Use /ai/upload-course first."
    
    query_vec = EMBEDDING_MODEL.encode(query)
    similarities = []
    for chunk in chunks:
        doc_vec = np.array(chunk["embedding"])
        sim = np.dot(query_vec, doc_vec) / (np.linalg.norm(query_vec) * np.linalg.norm(doc_vec))
        similarities.append((sim, chunk["text"]))
    
    similarities.sort(key=lambda x: x[0], reverse=True)
    top_texts = [text for _, text in similarities[:top_k]]
    return "\n\n---\n\n".join(top_texts)

def tool_generate_exam(topic, user_id, num_questions=5):
    """Generate exam using RAG + existing exams"""
    # Get relevant course material
    course_context = tool_rag_search(f"Key concepts about {topic}", user_id, top_k=2)
    
    # Get similar past exams
    past_exams = list(exams_collection.find(
        {"created_by": ObjectId(user_id)},
        {"title": 1, "answer_key": 1}
    ).sort([("created_at", -1)]).limit(2))
    
    exam_examples = ""
    for ex in past_exams:
        for q in ex.get("answer_key", [])[:2]:
            exam_examples += f"- {q.get('question', 'N/A')}\n  Answer: {q.get('expected_answer', 'N/A')}\n"

    prompt = f"""
Generate a {num_questions}-question exam on: {topic}

COURSE CONTEXT:
{course_context}

PAST EXAM EXAMPLES:
{exam_examples}

Rules:
- Mix MCQs and short answer
- For MCQs, provide 4 options (a, b, c, d)
- Return JSON: {{"questions": [{{"type": "mcq"|"text", "question": "...", "options": [...], "answer": "..."}}]}}
"""
    
    headers = {"Authorization": f"Bearer {TOGETHER_API_KEY}", "Content-Type": "application/json"}
    payload = {
        "model": TOGETHER_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.7,
        "max_tokens": 800,
    }
    
    import requests
    response = requests.post(TOGETHER_ENDPOINT, headers=headers, json=payload, timeout=30)
    response.raise_for_status()
    raw = response.json()["choices"][0]["message"]["content"]
    
    # Extract JSON
    try:
        json_match = re.search(r"\{.*\}", raw, re.DOTALL)
        if json_match:
            return json.loads(json_match.group())
    except:
        pass
    return {"error": "Failed to generate exam", "raw": raw}

# ---------- ReAct Agent ----------
def run_react_agent(user_query, user_id, session_id):
    system_prompt = """
You are ProfMate, an AI teaching assistant with these tools:

TOOL SPECS:
- list_exams() → [exams]
- get_exam(exam_id) → exam details
- list_submissions(exam_id?) → [submissions]
- rag_search(query) → relevant course material
- generate_exam(topic, num_questions=5) → new exam

RULES:
1. Think step by step.
2. Call ONE tool in JSON: {"tool": "tool_name", "args": {...}}
3. Use observation to answer.
4. For exam generation, ALWAYS call rag_search first to get course context.
"""
    
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_query},
    ]
    
    headers = {"Authorization": f"Bearer {TOGETHER_API_KEY}", "Content-Type": "application/json"}
    payload = {
        "model": TOGETHER_MODEL,
        "messages": messages,
        "temperature": 0.0,
        "max_tokens": 200,
    }
    
    import requests
    response = requests.post(TOGETHER_ENDPOINT, headers=headers, json=payload, timeout=30)
    first_response = response.json()["choices"][0]["message"]["content"].strip()
    
    # Parse tool call
    tool_call = None
    try:
        if first_response.strip().startswith("{"):
            tool_call = json.loads(first_response)
    except:
        pass

    if tool_call and "tool" in tool_call:
        tool_name = tool_call["tool"]
        args = tool_call.get("args", {})
        observation = "Tool failed."
        
        try:
            if tool_name == "list_exams":
                observation = json.dumps(tool_list_exams(user_id))
            elif tool_name == "get_exam":
                observation = json.dumps(tool_get_exam(args.get("exam_id")))
            elif tool_name == "list_submissions":
                observation = json.dumps(tool_list_submissions(args.get("exam_id")))
            elif tool_name == "rag_search":
                observation = tool_rag_search(args.get("query", ""), user_id)
            elif tool_name == "generate_exam":
                topic = args.get("topic", "general")
                num = args.get("num_questions", 5)
                observation = json.dumps(tool_generate_exam(topic, user_id, num))
            else:
                observation = f"Unknown tool: {tool_name}"
        except Exception as e:
            observation = f"Error: {str(e)}"

        # Final answer
        messages.extend([
            {"role": "assistant", "content": first_response},
            {"role": "user", "content": f"Observation: {observation}"},
            {"role": "user", "content": "Now give the final answer."}
        ])
        payload["messages"] = messages
        payload["max_tokens"] = 500
        response = requests.post(TOGETHER_ENDPOINT, headers=headers, json=payload, timeout=30)
        final_answer = response.json()["choices"][0]["message"]["content"].strip()
    else:
        final_answer = first_response

    return final_answer

# ---------- Routes ----------
@bp_ai.route("/ai/agent", methods=["POST"])
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