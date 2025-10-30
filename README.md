# CorrectMeAI – AI-Powered Exam Correction Platform

**CorrectMeAI** is an AI-driven web application developed during an internship at **Mahd.Group** that transforms how teachers correct exams. By combining **OCR**, **large language models (LLMs)**, and **intelligent agents**, CorrectMeAI automatically extracts student answers from scanned exam papers, compares them against the teacher’s answer key using the **Qwen3 LLM**, and delivers **detailed per-question feedback** along with an **overall grade out of 20**.

Teachers can also interact naturally with their exam data through a **chatbot powered by Retrieval-Augmented Generation (RAG)** and a **ReAct-style agent with memory**, enabling queries like _“Which students missed question 3?”_ or _“Show me feedback for Ahmed’s exam.”_

Built with a **React.js frontend**, **Flask backend**, and **MongoDB**, CorrectMeAI demonstrates how AI can make grading **faster, fairer, and more insightful**.

---

## ✨ Key Features

- **OCR-based answer extraction** from scanned exam papers  
- **Automated grading** using the **Qwen3 LLM**  
- **Per-question feedback** + **overall grade (out of 20)**  
- **Interactive AI chatbot** with **RAG + ReAct agent** and conversation memory  
- **Secure authentication** via **JWT** and **Google OAuth**  
- **Scalable data management** with **MongoDB**

---

## 🛠️ Technologies Used

### Frontend
- React.js

### Backend
- Python  
- Flask  
- JWT Authentication  
- Google OAuth  

### AI & Intelligence
- OCR (Optical Character Recognition)  
- **Qwen3 LLM** for semantic comparison and grading  
- **Retrieval-Augmented Generation (RAG)**  
- **ReAct-style agent** with memory for natural-language interaction  

### Database
- MongoDB

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)  
- Python 3.11+  
- MongoDB instance (local or cloud)  
- Access to **Qwen3 API** (via Alibaba Cloud or OpenRouter)  
- Google OAuth credentials (for login)  

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/sarrabousnina/CorrectMeAi.git
   cd CorrectMeAI
   ```

2. **Install frontend dependencies**
   ```bash
   cd client
   npm install
   ```

3. **Install backend dependencies**
   ```bash
   cd ../server
   pip install -r requirements.txt
   ```

4. **Set up environment variables**  
   Create `.env` files in both `client` and `server` folders (use `.env.example` as a template). Include:
   - `MONGODB_URI`
   - `QWEN3_API_KEY`
   - `GOOGLE_CLIENT_ID`
   - `JWT_SECRET_KEY`

5. **Run the application**
   ```bash
   # Terminal 1: Frontend
   cd client && npm start

   # Terminal 2: Backend
   cd server && python app.py
   ```

---

## 🔐 Authentication

CorrectMeAI supports:
- **Google Sign-In** for seamless teacher onboarding  
- **JWT-based session management** for secure API access  

All exam data is scoped to the authenticated teacher’s account.

---

## 🤖 AI Grading & Chatbot

- The system uses **OCR** to convert scanned answer sheets into text.  
- Each student response is compared to the **teacher-provided answer key** using **Qwen3**, which evaluates correctness, completeness, and reasoning.  
- Feedback is generated per question, and a final grade (e.g., **16.5 / 20**) is computed.  
- Teachers can ask follow-up questions via the **RAG + ReAct chatbot**, which retrieves relevant exam records and maintains conversation context.

---

## 📦 Data Model (MongoDB)

- **Teachers**: Auth & profile info  
- **Exams**: Metadata, answer key, grading rubric  
- **Submissions**: OCR-extracted answers, grades, feedback  
- **Chat History**: Stored per teacher for agent memory  

---

## 📄 License

This project was developed as part of an internship at **Mahd.Group** and is intended for educational and demonstration purposes. Usage rights are subject to agreement with the original stakeholders.

---

## 🙌 Acknowledgements

- Internship host: **Mahd.Group**  
- LLM provider: **Qwen (Alibaba Cloud)**  
- Inspired by the need for **fair, transparent, and efficient** exam evaluation in modern education.

> AI doesn’t replace teachers—it empowers them.
