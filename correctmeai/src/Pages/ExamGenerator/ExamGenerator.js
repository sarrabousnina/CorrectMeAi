import { useState } from "react";

// Backend base URL
const API_BASE = "http://localhost:5010";

const label = { fontSize: 12, fontWeight: 600, marginBottom: 4, display: "block" };
const inp = { padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8, outline: "none", width: "100%" };
const btn = { padding: "10px 14px", borderRadius: 10, border: "1px solid #111827", background: "#111827", color: "#fff", cursor: "pointer", fontWeight: 600 };

function toText(v) {
    if (v == null) return "";
    if (typeof v === "string") return v;
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    if (Array.isArray(v)) return v.map(toText).join(" ");
    if (typeof v === "object") {
        const candidate = v.text ?? v.passage ?? v.prompt ?? v.content ?? v.value;
        if (candidate != null) return toText(candidate);
        try { return JSON.stringify(v); } catch { return String(v); }
    }
    return String(v);
}
function toArrayOfText(arr) { if (!Array.isArray(arr)) return []; return arr.map((x) => toText(x)).filter((s) => s && s.trim() !== ""); }
function safeMarks(m) { const n = Number(m); return Number.isFinite(n) ? n : 0; }

export default function ExamGenerator() {
    const [form, setForm] = useState({
        subject: "English",
        topic: "Pollution & Environment",
        grade: "2",
        duration: 45,
        total_marks: 20,
        model: "llama3.2:1b",
        output: "text", // "text" | "json"
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [history, setHistory] = useState([]);
    const [reply, setReply] = useState(null);   // string or JSON
    const [isJson, setIsJson] = useState(false);

    const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

    const buildMessage = () => (
        `Create a complete ${form.subject} exam for Grade ${form.grade} on "${form.topic}".\n` +
        `Duration: ${Number(form.duration)} minutes. Total marks: ${Number(form.total_marks)}.\n` +
        `Sections required: Reading (short passage + 3–4 questions), Vocabulary (5 questions), Grammar (3–5 questions), Writing (1 short essay with rubric).`
    );

    async function handleGenerate() {
        try {
            setLoading(true);
            setError("");

            const res = await fetch(`${API_BASE}/api/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    preset: form.output === "json" ? "exam_generator_json" : "exam_generator_text",
                    message: buildMessage(),
                    model: form.model,
                    cpu_only: true,
                    force_json: form.output === "json",
                    history,
                }),
            });

            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            setHistory(data.messages || []);
            const jsonMode = data.type === "json" || typeof data.reply === "object";
            setIsJson(jsonMode);
            setReply(data.reply);
        } catch (e) {
            setError(e.message || "Something went wrong");
        } finally {
            setLoading(false);
        }
    }

    function downloadJSON() {
        if (!reply) return;
        const blob = new Blob([JSON.stringify(reply, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const meta = reply?.meta;
        const name = meta ? `${(meta.subject || "Exam")}-${(meta.topic || "Topic")}.json` : "exam.json";
        a.download = name.replace(/\s+/g, "_");
        a.click();
        URL.revokeObjectURL(url);
    }

    function downloadTXT() {
        if (!reply || typeof reply !== "string") return;
        const blob = new Blob([reply], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "exam.txt";
        a.click();
        URL.revokeObjectURL(url);
    }

    return (
        <div style={{ fontFamily: "Inter, ui-sans-serif, system-ui", padding: 24, maxWidth: 1100, margin: "0 auto" }}>
            <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>Exam Generator</h1>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <div>
                        <div style={label}>Model</div>
                        <select name="model" value={form.model} onChange={onChange} style={{ ...inp, width: 240 }}>
                            <option value="llama3.2:1b">llama3.2:1b (light)</option>
                            <option value="llama3.2:3b">llama3.2:3b (better)</option>
                        </select>
                    </div>
                    <div>
                        <div style={label}>Output</div>
                        <select name="output" value={form.output} onChange={onChange} style={{ ...inp, width: 180 }}>
                            <option value="text">Printable text</option>
                            <option value="json">JSON (advanced)</option>
                        </select>
                    </div>
                </div>
            </header>

            {/* Inputs with clear labels */}
            <section style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12, marginBottom: 16 }}>
                <div style={{ gridColumn: "span 2" }}>
                    <label style={label}>Subject</label>
                    <input style={inp} name="subject" value={form.subject} onChange={onChange} placeholder="e.g., English" />
                </div>
                <div style={{ gridColumn: "span 3" }}>
                    <label style={label}>Topic</label>
                    <input style={inp} name="topic" value={form.topic} onChange={onChange} placeholder="e.g., Pollution & Environment" />
                </div>
                <div>
                    <label style={label}>Grade</label>
                    <input style={inp} name="grade" value={form.grade} onChange={onChange} placeholder="e.g., 2" />
                </div>
                <div>
                    <label style={label}>Duration (min)</label>
                    <input style={inp} type="number" name="duration" value={form.duration} onChange={onChange} placeholder="e.g., 45" />
                </div>
                <div>
                    <label style={label}>Total Marks</label>
                    <input style={inp} type="number" name="total_marks" value={form.total_marks} onChange={onChange} placeholder="e.g., 20" />
                </div>
                <div style={{ alignSelf: "end" }}>
                    <button style={btn} onClick={handleGenerate} disabled={loading}>
                        {loading ? "Generating…" : "Generate exam"}
                    </button>
                </div>
            </section>

            {error && <div style={{ color: "#b91c1c", marginTop: 8 }}>{error}</div>}

            {/* Printable text preview */}
            {reply && !isJson && typeof reply === "string" && (
                <div style={{ marginTop: 20 }}>
                    <div style={{ padding: 16, background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                        {reply}
                    </div>
                    <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
                        <button style={btn} onClick={downloadTXT}>Download .TXT</button>
                    </div>
                </div>
            )}

            {/* JSON preview (advanced) */}
            {reply && isJson && (
                <div style={{ marginTop: 20 }}>
                    <Preview exam={reply} />
                    <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
                        <button style={btn} onClick={downloadJSON}>Download JSON</button>
                    </div>
                </div>
            )}
        </div>
    );
}

function Preview({ exam }) {
    const meta = exam?.meta || {};
    const sections = (Array.isArray(exam?.sections) ? exam.sections : [])
        .filter(s => (toText(s?.content).trim().length > 0) || (Array.isArray(s?.questions) && s.questions.length > 0));

    return (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16 }}>
            <div style={{ marginBottom: 6 }}>
                <div style={{ fontWeight: 800, fontSize: 18 }}>
                    {toText(meta.subject) || "Subject"} — {toText(meta.topic) || "Topic"}
                </div>
                <div style={{ opacity: 0.75 }}>
                    Grade {toText(meta.grade) || "?"} • Duration: {toText(meta.duration) || "?"} • Total: {toText(meta.total_marks) || "?"} marks
                </div>
            </div>
            <hr style={{ margin: "12px 0" }} />

            {sections.map((s, i) => {
                const title = toText(s?.title) || `Section ${i + 1}`;
                const instructions = toText(s?.instructions);
                const content = toText(s?.content);
                const questions = Array.isArray(s?.questions) ? s.questions : [];
                const extraLines = Number(s?.lines) || 0;
                const rubricList = toArrayOfText(s?.rubric);

                return (
                    <div key={i} style={{ marginBottom: 18 }}>
                        <h3 style={{ margin: "6px 0" }}>{title}</h3>
                        {instructions && <p style={{ margin: "6px 0" }}>{instructions}</p>}
                        {content && <p style={{ background: "#f1f5f9", padding: 12, borderRadius: 8 }}>{content}</p>}

                        {questions.map((q, qi) => {
                            const qText = toText(q?.q);
                            const qType = toText(q?.type) || "short";
                            const qMarks = safeMarks(q?.marks);
                            const options = toArrayOfText(q?.options);
                            const answer = toText(q?.answer);
                            const rubric = toArrayOfText(q?.rubric);

                            return (
                                <div key={qi} style={{ marginTop: 8 }}>
                                    <strong>{qi + 1}) {qText || "(question)"} </strong>
                                    <span style={{ opacity: 0.7 }}>
                    ({qType}, {qMarks} mark{qMarks === 1 ? "" : "s"})
                  </span>

                                    {qType === "mcq" && options.length > 0 && (
                                        <ul style={{ marginTop: 6 }}>
                                            {options.map((o, oi) => (
                                                <li key={oi}>( {String.fromCharCode(97 + oi)} ) {o}</li>
                                            ))}
                                        </ul>
                                    )}

                                    {qType !== "essay" && answer && (
                                        <div style={{ fontSize: 13, opacity: 0.75 }}>Answer: {answer}</div>
                                    )}

                                    {qType === "essay" && rubric.length > 0 && (
                                        <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>
                                            <em>Rubric:</em>
                                            <ul style={{ marginTop: 4 }}>
                                                {rubric.map((r, ri) => <li key={ri}>{r}</li>)}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {extraLines > 0 && (
                            <div style={{ marginTop: 8 }}>
                                {Array.from({ length: extraLines }).map((_, li) => (
                                    <div key={li} style={{ borderBottom: "1px solid #e5e7eb", margin: "6px 0" }} />
                                ))}
                            </div>
                        )}

                        {rubricList.length > 0 && (
                            <div style={{ fontSize: 13, opacity: 0.8, marginTop: 8 }}>
                                <em>Rubric:</em>
                                <ul style={{ marginTop: 4 }}>
                                    {rubricList.map((r, ri) => <li key={ri}>{r}</li>)}
                                </ul>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
