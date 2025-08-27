import { useState } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

/* ===== Fixed config ===== */
const API_BASE = "http://127.0.0.1:5010"; // IMPORTANT: use 127.0.0.1 to avoid IPv6 buffering
const FIXED_SUBJECT = "English";
const FIXED_MODEL = "llama3.2:1b";
const FIXED_TOTAL = 20;

/* ===== tiny styles ===== */
const label = { fontSize: 12, fontWeight: 600, marginBottom: 4, display: "block" };
const inp = { padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8, outline: "none", width: "100%" };
const btn = { padding: "10px 14px", borderRadius: 10, border: "1px solid #111827", background: "#111827", color: "#fff", cursor: "pointer", fontWeight: 600 };

/* ===== helpers ===== */
const toText = (v) =>
    v == null
        ? ""
        : typeof v === "string"
            ? v
            : typeof v === "number" || typeof v === "boolean"
                ? String(v)
                : Array.isArray(v)
                    ? v.map(toText).join(" ")
                    : typeof v === "object"
                        ? v.text ?? v.passage ?? v.prompt ?? v.content ?? v.value ?? JSON.stringify(v)
                        : String(v);
const toArray = (arr) => (Array.isArray(arr) ? arr : []);
const isNonEssay = (q) =>
    q && typeof q === "object" && ["mcq", "short", "cloze", "tick", "circle", "true_false", "match"].includes((q.type || "").toLowerCase());

/* tolerant JSON parser */
function safeParseJSON(text) {
    if (!text || typeof text !== "string") return null;
    try { return JSON.parse(text); } catch {}
    let fixed = text.replace(/,\s*([}\]])/g, "$1").replace(/[\u0000-\u001F]+/g, "");
    const s = fixed.indexOf("{"), e = fixed.lastIndexOf("}");
    if (s !== -1 && e > s) fixed = fixed.slice(s, e + 1);
    try { return JSON.parse(fixed); } catch { return null; }
}

function convertFromMcq(q, variant) {
    const copy = { ...q };
    const ans = copy.answer;
    if (variant === "tick") {
        copy.type = "tick";
        if (ans != null) copy.answers = [String(ans)];
        return copy;
    }
    if (variant === "circle") {
        copy.type = "circle";
        copy.answer = ans != null ? String(ans) : "a";
        return copy;
    }
    copy.type = "short";
    if (typeof copy.answer !== "string" || !copy.answer.trim()) {
        const opts = toArray(copy.options);
        if (opts.length) copy.answer = String(opts[0]);
    }
    delete copy.options; delete copy.answers; delete copy.pairs_left; delete copy.pairs_right;
    return copy;
}

/* diversity enforcement */
function rebalanceExam(exam) {
    if (!exam || typeof exam !== "object") return exam;
    const sections = toArray(exam.sections);

    for (const s of sections) {
        const title = (s?.title || "").toLowerCase();
        if (title.includes("writing") || title.includes("essay")) continue;
        const qs = toArray(s.questions);
        let mcqCount = 0;
        let types = new Set();
        for (let i = 0; i < qs.length; i++) {
            const t = (qs[i]?.type || "").toLowerCase();
            if (!isNonEssay(qs[i])) continue;
            types.add(t);
            if (t === "mcq") {
                mcqCount++;
                if (mcqCount > 1) {
                    qs[i] = convertFromMcq(qs[i], i % 2 === 0 ? "tick" : "short");
                    types.add(qs[i].type.toLowerCase());
                }
            }
        }
        if (Array.from(types).filter((x) => x !== "essay").length < 2) {
            for (let i = 0; i < qs.length; i++) {
                if (!isNonEssay(qs[i])) continue;
                if ((qs[i].type || "").toLowerCase() === "short") {
                    qs[i] = { ...qs[i], type: "circle", options: qs[i].options || ["Yes", "No"], answer: qs[i].answer || "Yes" };
                    break;
                }
            }
        }
        s.questions = qs;
    }

    let all = [], mcqs = [];
    sections.forEach((s, si) => {
        toArray(s.questions).forEach((q, qi) => {
            if (isNonEssay(q)) {
                all.push([si, qi]);
                if ((q.type || "").toLowerCase() === "mcq") mcqs.push([si, qi]);
            }
        });
    });
    const maxMcq = Math.floor(all.length * 0.15);
    if (mcqs.length > maxMcq) {
        let toggle = 0;
        for (const [si, qi] of mcqs.slice(maxMcq)) {
            const q = sections[si].questions[qi];
            sections[si].questions[qi] = convertFromMcq(q, toggle % 2 === 0 ? "tick" : "short");
            toggle++;
        }
    }

    exam.sections = sections;
    return exam;
}

/* rendering */
const TYPE_ORDER = ["tick", "circle", "cloze", "short", "true_false", "match", "mcq", "essay"];
const TYPE_LABEL = {
    tick: "Tick the right answer.", circle: "Circle the correct alternative.", cloze: "Fill in the blanks.",
    short: "Answer the questions.", true_false: "True or False.", match: "Match the sentence parts.",
    mcq: "Choose the correct option.", essay: "Writing",
};
const BULLET = { mcq: (i) => `( ${String.fromCharCode(97 + i)} )`, tick: () => "[ ]", circle: () => "( )", true_false: () => "( )" };

function renderSectionGrouped(s, qStartNumber) {
    const out = []; let qn = qStartNumber;
    const title = toText(s.title) || "Section";
    const instr = toText(s.instructions);
    const content = toText(s.content);
    const rubric = toArray(s.rubric);

    out.push(`${title}`); if (instr) out.push(instr);
    if (content) { out.push("[Passage]"); out.push(content); }

    const groups = {}; for (const t of TYPE_ORDER) groups[t] = [];
    for (const q of toArray(s.questions)) {
        const t = (q?.type || "short").toLowerCase(); (groups[t] || (groups[t] = [])).push(q);
    }

    let letterIndex = 0;
    for (const t of TYPE_ORDER) {
        const qs = groups[t]; if (!qs || qs.length === 0) continue;
        if (t !== "essay") {
            const prefix = String.fromCharCode(65 + letterIndex); letterIndex++;
            out.push(`${prefix}) ${TYPE_LABEL[t] || t}`);
        }
        for (const q of qs) {
            const txt = toText(q.q);
            if (t === "mcq" || t === "tick" || t === "circle" || t === "true_false") {
                out.push(`${qn}) ${txt}`);
                const opts = toArray(q.options);
                for (let i = 0; i < opts.length; i++) {
                    const bullet = BULLET[t] ? BULLET[t](i) : "•";
                    out.push(`   ${bullet} ${opts[i]}`);
                }
            } else if (t === "match") {
                out.push(`${qn}) ${txt}`); out.push("   Column A:");
                toArray(q.pairs_left).forEach((l, i) => out.push(`     ${String.fromCharCode(65 + i)}. ${l}`));
                out.push("   Column B:"); toArray(q.pairs_right).forEach((r, i) => out.push(`     ${i + 1}. ${r}`));
            } else if (t === "cloze") {
                out.push(`${qn}) ${txt}`);
            } else if (t === "essay") {
                out.push(`Writing`); out.push(txt ? `Prompt: ${txt}` : "Write a short paragraph.");
                for (let i = 0; i < 10; i++) out.push("   " + "_".repeat(60));
                const r = toArray(q.rubric); if (r.length) { out.push("Rubric:"); r.forEach((x) => out.push(` - ${x}`)); }
            } else { // short
                out.push(`${qn}) ${txt}`); for (let i = 0; i < 2; i++) out.push("   " + "_".repeat(40));
            }
            qn++;
        }
    }
    if (rubric.length) { out.push("Rubric:"); rubric.forEach((r) => out.push(` - ${r}`)); }

    return { text: out.join("\n"), nextQ: qn };
}

function renderExamText(exam) {
    const meta = exam?.meta || {};
    const topic = toText(meta.topic) || "Topic";
    const grade = toText(meta.grade) || "?";
    const duration = toText(meta.duration) || "?";
    const total = FIXED_TOTAL;

    const L = []; const line = () => L.push("-".repeat(72));
    L.push(`${FIXED_SUBJECT} — ${topic}`);
    L.push(`Grade ${grade} • Duration: ${duration} minutes • Total: ${total} marks`);
    line();
    L.push("Name: ____________________   Class: ___________   Number: ______   Date: ___________");
    line();

    let qn = 1; const key = [];
    for (const s of toArray(exam.sections)) {
        const { text, nextQ } = renderSectionGrouped(s, qn);
        L.push(""); L.push(text);
        for (const q of toArray(s.questions)) {
            const t = (q?.type || "").toLowerCase();
            if (t === "essay") continue;
            const idx = qn;
            let ak = ""; if (toArray(q.answers).length) ak = toArray(q.answers).join(", ");
            else if (q.answer != null) ak = String(q.answer);
            if (ak) key.push(`${idx}) ${ak}`);
            qn++;
        }
        qn = nextQ;
    }
    if (key.length) { L.push(""); line(); L.push("Answer Key"); line(); L.push(...key); }
    return L.join("\n").replace(/\n{3,}/g, "\n\n") + "\n";
}

/* Student header block */
function StudentHeader() {
    const line = { display: "inline-block", borderBottom: "1px solid #111827", minWidth: 180, height: 18 };
    const sline = { ...line, minWidth: 120 };
    const lab = { fontWeight: 600, marginRight: 6 };
    return (
        <div style={{ background: "#fff", paddingBottom: 8, marginBottom: 8 }}>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
                <span style={lab}>Name:</span><span style={line}></span>
                <span style={lab}>Class:</span><span style={sline}></span>
                <span style={lab}>Number:</span><span style={sline}></span>
                <span style={lab}>Date:</span><span style={sline}></span>
            </div>
            <hr style={{ border: "none", borderTop: "1px dashed #cbd5e1", margin: "8px 0 0 0" }} />
        </div>
    );
}

/* Main component (SSE) */
export default function ExamGenerator() {
    const [form, setForm] = useState({ topic: "Pollution & Environment", grade: "2", duration: 45 });
    const [streaming, setStreaming] = useState(false);
    const [raw, setRaw] = useState("");
    const [printText, setPrintText] = useState("");
    const [error, setError] = useState("");

    const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

    async function handleStream() {
        setStreaming(true); setError(""); setRaw(""); setPrintText("");

        // Build SSE URL with query params
        const qs = new URLSearchParams({
            topic: form.topic || "",
            grade: String(form.grade || "2"),
            duration: String(Number(form.duration || 45)),
        });
        const url = `${API_BASE}/api/chat/stream_sse?${qs.toString()}`;

        // Use native SSE
        const es = new EventSource(url);

        es.onmessage = (ev) => {
            const token = ev.data || "";
            setRaw((prev) => {
                const full = prev + token;
                const obj = safeParseJSON(full);
                if (obj) {
                    obj.meta = obj.meta || {};
                    obj.meta.subject = FIXED_SUBJECT;
                    obj.meta.total_marks = FIXED_TOTAL;
                    obj.meta.topic = form.topic;
                    obj.meta.grade = form.grade;
                    obj.meta.duration = Number(form.duration || 45);
                    const fixed = rebalanceExam(obj);
                    setPrintText(renderExamText(fixed));
                }
                return full;
            });
        };

        es.addEventListener("done", () => { es.close(); setStreaming(false); });
        es.addEventListener("error", (e) => {
            try { const data = JSON.parse(e.data || "{}"); setError(data.detail || "Stream error"); }
            catch { setError("Stream error"); }
            es.close(); setStreaming(false);
        });
    }

    async function downloadPDF() {
        const node = document.getElementById("exam-preview");
        if (!node) return;
        const canvas = await html2canvas(node, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF("p", "pt", "a4");
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = pageWidth;
        const imgHeight = canvas.height * (imgWidth / canvas.width);
        let heightLeft = imgHeight, position = 0;
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
        while (heightLeft > 0) {
            pdf.addPage();
            position = -(imgHeight - heightLeft);
            pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
        }
        const name = `${FIXED_SUBJECT}-${(form.topic || "Exam")}.pdf`.replace(/\s+/g, "_");
        pdf.save(name);
    }

    return (
        <div style={{ fontFamily: "Inter, ui-sans-serif, system-ui", padding: 24, maxWidth: 1100, margin: "0 auto" }}>
            <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>Exam Generator (Stream-only)</h1>
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                    Model: <strong>{FIXED_MODEL}</strong> • Subject: <strong>{FIXED_SUBJECT}</strong> • Total: <strong>{FIXED_TOTAL}</strong>
                </div>
            </header>

            <section style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12, marginBottom: 16 }}>
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
                <div style={{ alignSelf: "end" }}>
                    <button style={btn} onClick={handleStream} disabled={streaming}>
                        {streaming ? "Streaming…" : "Stream"}
                    </button>
                </div>
            </section>

            {error && <div style={{ color: "#b91c1c", marginTop: 8 }}>{error}</div>}

            <div style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>{streaming ? "Generating live…" : printText ? "Preview" : "Preview (empty)"}</div>
                <div id="exam-preview" style={{ padding: 16, border: "1px solid #e5e7eb", borderRadius: 12, background: "#fff", whiteSpace: "pre-wrap", lineHeight: 1.5, minHeight: 100 }}>
                    <StudentHeader />
                    {printText || "—"}
                </div>
                {printText && (
                    <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
                        <button style={btn} onClick={downloadPDF}>Download PDF</button>
                    </div>
                )}
            </div>
        </div>
    );
}
