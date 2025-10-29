import React, { useEffect, useRef, useState } from "react";
import "./ProfChat.css";
import {getAuth} from "../../JWT/api";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:5006";

export default function ProfChat({ sessionId = "prof-global" }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { 
      role: "assistant", 
      text: "👋 Hi! I'm ProfMate. I can:\n• List your exams\n• Show submissions\n• Generate new exams\n• Answer questions about your course material\n\nUpload course material first for best results!" 
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [courseFile, setCourseFile] = useState(null);
  const [courseName, setCourseName] = useState("");
  const endRef = useRef(null);

  // Auto-scroll
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const getAuthHeader = () => {
    const { token } = getAuth();
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const send = async (text) => {
    if (!text.trim() || busy) return;

    setMessages((prev) => [...prev, { role: "user", text }]);
    setInput("");
    setBusy(true);

    try {
      const response = await fetch(`${API_BASE}/ai/agent`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({ 
          message: text, 
          session_id: sessionId 
        }),
      });

      const data = await response.json();
      const reply = data.reply || "Sorry, I couldn't process that request.";

      setMessages((prev) => [...prev, { role: "assistant", text: reply }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "❌ Sorry — I couldn’t reach the server." },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const extractTextFromFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      // For text files, read as text
      if (file.type === 'text/plain' || file.name.endsWith('.txt') || 
          file.type === 'text/markdown' || file.name.endsWith('.md') ||
          file.type === 'text/html' || file.name.endsWith('.html')) {
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => reject(new Error("Failed to read text file"));
        reader.readAsText(file);
      }
      // For PDFs, we'll send the file as binary and let backend handle extraction
      else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        // Read as ArrayBuffer to send binary data
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => reject(new Error("Failed to read PDF file"));
        reader.readAsArrayBuffer(file);
      }
      else {
        reject(new Error("Unsupported file type"));
      }
    });
  };

  const handleUploadCourse = async () => {
    if (!courseFile || !courseName.trim()) {
      alert("Please select a file and enter a course name.");
      return;
    }

    setBusy(true);
    
    try {
      const fileContent = await extractTextFromFile(courseFile);
      
      // Check if it's a PDF (ArrayBuffer) or text (string)
      const isPdf = courseFile.type === 'application/pdf' || courseFile.name.endsWith('.pdf');
      
      if (isPdf) {
        // Send PDF as binary data
        const blob = new Blob([fileContent], { type: 'application/pdf' });
        const formData = new FormData();
        formData.append('file', blob, courseFile.name);
        formData.append('name', courseName.trim());

        const response = await fetch(`${API_BASE}/ai/upload-course`, {
          method: "POST",
          headers: { 
            ...getAuthHeader(),
            // Don't set Content-Type for FormData
          },
          body: formData,
        });

        const result = await response.json();
        if (response.ok) {
          setMessages((prev) => [
            ...prev,
            { 
              role: "assistant", 
              text: `✅ ${result.message}\n\nYou can now ask me to generate exams based on this material!` 
            },
          ]);
          setShowUpload(false);
          setCourseFile(null);
          setCourseName("");
        } else {
          throw new Error(result.error || "Upload failed");
        }
      } else {
        // Send text as JSON
        const response = await fetch(`${API_BASE}/ai/upload-course`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            ...getAuthHeader(),
          },
          body: JSON.stringify({
            name: courseName.trim(),
            text: fileContent,
          }),
        });

        const result = await response.json();
        if (response.ok) {
          setMessages((prev) => [
            ...prev,
            { 
              role: "assistant", 
              text: `✅ ${result.message}\n\nYou can now ask me to generate exams based on this material!` 
            },
          ]);
          setShowUpload(false);
          setCourseFile(null);
          setCourseName("");
        } else {
          throw new Error(result.error || "Upload failed");
        }
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: `❌ Upload error: ${err.message}` },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const text = input.trim();
    if (text) send(text);
  };

  const ChatShell = (
    <div className="pcb-shell">
      <main className="pcb-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`pcb-row ${msg.role === "user" ? "pcb-right" : "pcb-left"}`}>
            <div className={`pcb-bubble ${msg.role === "user" ? "pcb-user" : "pcb-assistant"}`}>
              {msg.text.split('\n').map((line, j) => (
                <React.Fragment key={j}>
                  {line}
                  {j < msg.text.split('\n').length - 1 && <br />}
                </React.Fragment>
              ))}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </main>
      
      {showUpload ? (
        <div className="pcb-upload-section">
          <input
            type="text"
            placeholder="Course name (e.g., Linear Algebra)"
            value={courseName}
            onChange={(e) => setCourseName(e.target.value)}
            disabled={busy}
            style={{ marginBottom: 8, padding: "6px 10px" }}
          />
          <input
            type="file"
            accept=".txt,.pdf,.md"
            onChange={(e) => setCourseFile(e.target.files?.[0] || null)}
            disabled={busy}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button 
              className="pcb-send" 
              onClick={handleUploadCourse}
              disabled={busy}
            >
              {busy ? "Uploading..." : "Upload Course"}
            </button>
            <button 
              className="pcb-send" 
              onClick={() => setShowUpload(false)}
              disabled={busy}
              style={{ background: "#6c757d" }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <form className="pcb-inputbar" onSubmit={handleSubmit}>
          <input
            className="pcb-input"
            placeholder="Type your message... (e.g., 'Generate an exam on calculus')"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={busy}
          />
          <button className="pcb-send" type="submit" disabled={busy}>
            Send
          </button>
        </form>
      )}
      
      {!showUpload && (
        <div style={{ textAlign: "center", padding: "4px 0", fontSize: "0.8em", color: "#666" }}>
          <button 
            onClick={() => setShowUpload(true)}
            style={{ 
              background: "none", 
              border: "none", 
              color: "#2563eb", 
              cursor: "pointer",
              fontSize: "0.8em"
            }}
          >
            📚 Upload course material
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      <button
        className="pcb-fab"
        onClick={() => setOpen(true)}
        aria-label="Open ProfMate"
        title="Open ProfMate"
      >
        <img src="/ProfChat/robot.png" alt="ProfMate" className="pcb-fab-img" />
      </button>

      {open && (
        <div
          className="pcb-backdrop"
          onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div className="pcb-modal">
            <div className="pcb-modal-head">
              <h2 className="pcb-title">ProfMate</h2>
              <button className="pcb-close" onClick={() => setOpen(false)} aria-label="Close">
                ✕
              </button>
            </div>
            <div className="pcb-modal-body">{ChatShell}</div>
          </div>
        </div>
      )}
    </>
  );
}