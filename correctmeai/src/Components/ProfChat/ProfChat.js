import React, { useEffect, useRef, useState } from "react";
import "./ProfChat.css";
import robotIcon from "../../Images/robot.png"; // <-- your robot image

const API_BASE = import.meta?.env?.VITE_API_BASE || "http://localhost:5006";

export default function ProfChat({ sessionId = "prof-global" }) {
    const [open, setOpen] = useState(false);

    // Chat state
    const [messages, setMessages] = useState([
        { role: "assistant", text: "👋 Hi! I'm ProfMate, your assistant for exams and courses. Ask me anything!" }
    ]);
    const [input, setInput] = useState("");
    const [busy, setBusy] = useState(false);
    const endRef = useRef(null);

    // Auto-scroll to latest message
    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Close modal on ESC
    useEffect(() => {
        const onKey = (e) => e.key === "Escape" && setOpen(false);
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    const send = async (text) => {
        if (!text.trim() || busy) return;
        setMessages((m) => [...m, { role: "user", text }]);
        setInput("");
        setBusy(true);

        const res = await fetch(`${API_BASE}/ai/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: text, session_id: sessionId }),
        });

        // Prepare an empty assistant bubble for streaming
        setMessages((m) => [...m, { role: "assistant", text: "", streaming: true }]);

        const reader = res.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let acc = "";

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });

            chunk.split("\n\n").forEach((block) => {
                const line = block.trim();
                if (!line.startsWith("data: ")) return;
                try {
                    const obj = JSON.parse(line.slice(6));
                    if (obj.type === "token") {
                        acc += obj.data;
                        setMessages((m) => {
                            const copy = [...m];
                            copy[copy.length - 1] = { role: "assistant", text: acc, streaming: true };
                            return copy;
                        });
                    } else if (obj.type === "done") {
                        setMessages((m) => {
                            const copy = [...m];
                            copy[copy.length - 1].streaming = false;
                            return copy;
                        });
                    }
                } catch {}
            });
        }
        setBusy(false);
    };

    const onSubmit = (e) => {
        e.preventDefault();
        const text = input.trim();
        if (text) send(text);
    };

    // Chat UI inside the modal
    const ChatShell = (
        <div className="pcb-shell">
            <main className="pcb-messages">
                {messages.map((m, i) => (
                    <div key={i} className={`pcb-row ${m.role === "user" ? "pcb-right" : "pcb-left"}`}>
                        <div className={`pcb-bubble ${m.role === "user" ? "pcb-user" : "pcb-assistant"}`}>
                            {m.text}
                            {m.streaming && <span className="pcb-cursor">▌</span>}
                        </div>
                    </div>
                ))}
                <div ref={endRef} />
            </main>
            <form className="pcb-inputbar" onSubmit={onSubmit}>
                <input
                    className="pcb-input"
                    placeholder="Type your message..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                />
                <button className="pcb-send" disabled={busy}>Send</button>
            </form>
        </div>
    );

    return (
        <>
            {/* Floating mascot button (no background circle) */}
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
                    onMouseDown={(e) => {
                        if (e.target === e.currentTarget) setOpen(false);
                    }}
                    role="dialog"
                    aria-modal="true"
                    aria-label="ProfMate"
                >
                    <div className="pcb-modal">
                        <div className="pcb-modal-head">
                            <div className="pcb-title">ProfMate</div>
                            <button className="pcb-close" onClick={() => setOpen(false)} aria-label="Close">✕</button>
                        </div>
                        <div className="pcb-modal-body">{ChatShell}</div>
                    </div>
                </div>
            )}
        </>
    );
}
