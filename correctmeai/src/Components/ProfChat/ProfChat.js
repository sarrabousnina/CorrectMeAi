// src/Components/ProfChat/ProfChat.jsx
import React, { useEffect, useRef, useState } from "react";
import "./ProfChat.css";
import robotIcon from "../../images/robot.png";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5006";

export default function ProfChat({ sessionId = "prof-global" }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: "assistant", text: "👋 Hi! I'm ProfMate, your assistant for exams and courses. Ask me anything!" },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);

  // Auto-scroll to latest message
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const send = async (text) => {
    if (!text.trim() || busy) return;

    setMessages((prev) => [...prev, { role: "user", text }]);
    setInput("");
    setBusy(true);

    try {
      // Step 1: Try agent (tool-based response)
      const agentRes = await fetch(`${API_BASE}/ai/agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, session_id: sessionId }),
      });
      const agent = await agentRes.json();

      if (agent.handled) {
        setMessages((prev) => [...prev, { role: "assistant", text: agent.reply }]);
        return;
      }

      // Step 2: Fallback to streaming RAG chat
      const res = await fetch(`${API_BASE}/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, session_id: sessionId, use_rag: true }),
      });

      if (!res.ok) throw new Error("Chat API failed");

      setMessages((prev) => [...prev, { role: "assistant", text: "", streaming: true }]);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        chunk.split("\n\n").forEach((block) => {
          const line = block.trim();
          if (!line.startsWith("data: ")) return;

          try {
            const obj = JSON.parse(line.slice(6));
            if (obj.type === "token") {
              acc += obj.data;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", text: acc, streaming: true };
                return updated;
              });
            } else if (obj.type === "done") {
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1].streaming = false;
                return updated;
              });
            }
          } catch {}
        });
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "Sorry — I couldn’t reach the server." },
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
              {msg.text}
              {msg.streaming && <span className="pcb-cursor">▌</span>}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </main>
      <form className="pcb-inputbar" onSubmit={handleSubmit}>
        <input
          className="pcb-input"
          placeholder="Type your message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy}
        />
        <button className="pcb-send" type="submit" disabled={busy}>
          Send
        </button>
      </form>
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
        <img src={robotIcon} alt="ProfMate" className="pcb-fab-img" />
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