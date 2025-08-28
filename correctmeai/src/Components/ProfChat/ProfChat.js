import React, { useEffect, useRef, useState } from "react";
import "./ProfChat.css";

const API_BASE = import.meta?.env?.VITE_API_BASE || "http://localhost:5006";

export default function ProfChat({ sessionId = "prof-session-1" }) {
    const [messages, setMessages] = useState([
        { role: "assistant", text: "👋 Bonjour Prof ! Posez-moi vos questions (générer des questions, résumer un examen, etc.)." }
    ]);
    const [input, setInput] = useState("");
    const [busy, setBusy] = useState(false);
    const endRef = useRef(null);

    const scrollDown = () => endRef.current?.scrollIntoView({ behavior: "smooth" });
    useEffect(scrollDown, [messages]);

    const send = async (text) => {
        if (!text.trim() || busy) return;
        setMessages((m) => [...m, { role: "user", text }]);
        setInput("");
        setBusy(true);

        const res = await fetch(`${API_BASE}/ai/chat`, {
            method: "POST",   // ⬅ very important
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: text, session_id: sessionId }),
        });


        // Prepare an empty assistant message for streaming
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

    return (
        <div className="pc-shell">
            <header className="pc-header">Professor AI Assistant</header>

            <main className="pc-messages">
                {messages.map((m, i) => (
                    <div key={i} className={`pc-row ${m.role === "user" ? "pc-right" : "pc-left"}`}>
                        <div className={`pc-bubble ${m.role === "user" ? "pc-user" : "pc-assistant"}`}>
                            {m.text}
                            {m.streaming && <span className="pc-cursor">▌</span>}
                        </div>
                    </div>
                ))}
                <div ref={endRef} />
            </main>

            <form className="pc-inputbar" onSubmit={onSubmit}>
                <input
                    className="pc-input"
                    placeholder="Écrire un message…"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                />
                <button className="pc-send" disabled={busy}>Envoyer</button>
            </form>
        </div>
    );
}
