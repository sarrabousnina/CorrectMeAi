import os
import json
import time
from datetime import datetime
from bson import ObjectId
from flask import Blueprint, request, jsonify, g, stream_with_context
from flask_cors import cross_origin
import jwt
import numpy as np
from sentence_transformers import SentenceTransformer
from dotenv import load_dotenv

load_dotenv()

# DB
from mongo import exams_collection, submissions_collection

# Config
JWT_SECRET = os.getenv("JWT_SECRET")
TOGETHER_API_KEY = os.getenv("TOGETHER_API_KEY")
TOGETHER_ENDPOINT = os.getenv("TOGETHER_ENDPOINT", "https://api.together.xyz/v1/chat/completions")
TOGETHER_MODEL = os.getenv("TOGETHER_MODEL", "meta-llama/Llama-3-8b-chat-hf")

if not all([JWT_SECRET, TOGETHER_API_KEY]):
    raise RuntimeError("Missing required env vars: JWT_SECRET, TOGETHER_API_KEY")

# Embedding model (lightweight, runs on CPU)
EMBEDDING_MODEL = SentenceTransformer("all-MiniLM-L6-v2")

# Memory store (in production, use Redis or MongoDB)
SESSION_MEMORY = {}

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
    exams = list(exams_collection.find(
        {"created_by": ObjectId(user_id)},
        {"title": 1, "created_at": 1}
    ).sort([("created_at", -1)]))
    return [{"id": str(e["_id"]), "title": e["title"]} for e in exams]

def tool_get_exam(exam_id):
    """Get exam details"""
    exam = exams_collection.find_one({"_id": ObjectId(exam_id)})
    if not exam:
        return None
    return {
        "id": str(exam["_id"]),
        "title": exam.get("title"),
        "answer_key": exam.get("answer_key", []),
    }

def tool_list_submissions(exam_id=None):
    """List submissions for an exam"""
    if not exam_id:
        latest = exams_collection.find_one(sort=[("created_at", -1)])
        if not latest:
            return []
        exam_id = str(latest["_id"])
    subs = list(submissions_collection.find(
        {"exam_id": ObjectId(exam_id)}
    ).sort([("created_at", -1)]))
    return [
        {
            "id": str(s["_id"]),
            "student": s.get("student_name", "Unknown"),
            "score": s.get("score"),
            "feedback": s.get("feedback", "")[:100],
        }
        for s in subs
    ]

# ---------- RAG RETRIEVER ----------
def build_rag_index(user_id):
    """Build semantic index of user's exams for RAG"""
    docs = []
    exams = exams_collection.find(
        {"created_by": ObjectId(user_id)},
        {"title": 1, "answer_key": 1}
    )
    for exam in exams:
        for i, q in enumerate(exam.get("answer_key", [])):
            question_text = q.get("question", f"Question {i+1}")
            expected = q.get("expected_answer", "N/A")
            content = f"Exam: {exam['title']}\nQuestion: {question_text}\nExpected Answer: {expected}"
            embedding = EMBEDDING_MODEL.encode(content).tolist()
            docs.append({
                "content": content,
                "exam_id": str(exam["_id"]),
                "embedding": embedding,
                "type": "exam_question"
            })
    return docs

def retrieve_relevant_context(query, user_id, top_k=3):
    """Retrieve top-k relevant exam fragments using cosine similarity"""
    index = build_rag_index(user_id)
    if not index:
        return ""
    
    query_vec = EMBEDDING_MODEL.encode(query)
    similarities = []
    for doc in index:
        doc_vec = np.array(doc["embedding"])
        sim = np.dot(query_vec, doc_vec) / (np.linalg.norm(query_vec) * np.linalg.norm(doc_vec))
        similarities.append((sim, doc["content"]))
    
    similarities.sort(key=lambda x: x[0], reverse=True)
    top_docs = [doc for _, doc in similarities[:top_k]]
    return "\n\n".join(top_docs)

# ---------- ReAct AGENT ----------
def run_react_agent(user_query, user_id, session_id):
    """Run ReAct loop: Thought → Action → Observation → Final Answer"""
    # Get chat history
    history = SESSION_MEMORY.get(session_id, [])
    
    # Retrieve RAG context
    rag_context = retrieve_relevant_context(user_query, user_id)
    
    # Build prompt
    system_prompt = f"""
You are ProfMate, an AI teaching assistant. Use the following tools to answer questions:

TOOL SPECS:
- list_exams(): Returns [{{"id": str, "title": str}}]
- get_exam(exam_id: str): Returns exam details
- list_submissions(exam_id: str = None): Returns [{{"id": str, "student": str, "score": float}}]

RULES:
1. First, think step by step (Thought).
2. If you need data, call ONE tool in JSON: {{"tool": "tool_name", "args": {{...}}}}
3. Wait for the observation (tool result).
4. Use the observation to answer the user.
5. If no tool is needed, answer directly.

RAG CONTEXT (for reference only — do not mention unless relevant):
{rag_context[:1000]}

CHAT HISTORY:
{chr(10).join([f"User: {h['query']}" + (f"\\nAssistant: {h['response']}" if h.get('response') else "") for h in history[-2:]])}
""".strip()

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_query},
    ]

    # First LLM call: get tool decision
    payload = {
        "model": TOGETHER_MODEL,
        "messages": messages,
        "temperature": 0.0,
        "max_tokens": 200,
    }
    headers = {"Authorization": f"Bearer {TOGETHER_API_KEY}", "Content-Type": "application/json"}
    
    import requests
    response = requests.post(TOGETHER_ENDPOINT, headers=headers, json=payload, timeout=30)
    response.raise_for_status()
    first_response = response.json()["choices"][0]["message"]["content"].strip()

    # Check if it's a tool call
    tool_call = None
    try:
        if first_response.strip().startswith("{"):
            tool_call = json.loads(first_response)
    except:
        pass

    final_answer = ""
    if tool_call and "tool" in tool_call:
        # Execute tool
        tool_name = tool_call["tool"]
        args = tool_call.get("args", {})
        observation = "Tool execution failed."
        
        try:
            if tool_name == "list_exams":
                observation = json.dumps(tool_list_exams(user_id))
            elif tool_name == "get_exam":
                exam_id = args.get("exam_id")
                if exam_id:
                    result = tool_get_exam(exam_id)
                    observation = json.dumps(result) if result else "Exam not found."
                else:
                    observation = "Missing exam_id argument."
            elif tool_name == "list_submissions":
                exam_id = args.get("exam_id")
                observation = json.dumps(tool_list_submissions(exam_id))
            else:
                observation = f"Unknown tool: {tool_name}"
        except Exception as e:
            observation = f"Error: {str(e)}"

        # Second LLM call: generate final answer
        messages.append({"role": "assistant", "content": first_response})
        messages.append({"role": "user", "content": f"Observation: {observation}"})
        messages.append({"role": "user", "content": "Now give the final answer."})

        payload["messages"] = messages
        payload["max_tokens"] = 500
        response = requests.post(TOGETHER_ENDPOINT, headers=headers, json=payload, timeout=30)
        response.raise_for_status()
        final_answer = response.json()["choices"][0]["message"]["content"].strip()
        
        # Save to memory
        SESSION_MEMORY[session_id] = history[-4:] + [{"query": user_query, "response": final_answer}]
    else:
        # No tool needed
        final_answer = first_response
        SESSION_MEMORY[session_id] = history[-4:] + [{"query": user_query, "response": final_answer}]

    return final_answer

# ---------- ROUTES ----------
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

@bp_ai.route("/ai/chat", methods=["POST"])
@cross_origin()
def chat():
    """Fallback streaming chat (not used if agent handles it)"""
    return jsonify({"error": "Use /ai/agent for agent interactions"}), 400