import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const KeyPage = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const extractedText = location.state?.extractedText || "";

    // UI state
    const [saving, setSaving] = useState(false);
    const [successMsg, setSuccessMsg] = useState("");
    const [errorMsg, setErrorMsg] = useState("");

    const blankRegex = /(\.{3,}|_{3,})/;
    const excludedLabels = ["name", "class", "number", "notes"];

    const blocks = [];
    const lines = extractedText.split("\n");
    let i = 0;

    while (i < lines.length) {
        const line = lines[i].trim();

        // Detect MCQ question
        if (/tick|circle/i.test(line)) {
            let mcqLines = [line];
            i++;
            while (i < lines.length && /^\s*-?\s*[a-dA-D][\s☐\[\.\)\-]/.test(lines[i])) {
                mcqLines.push(lines[i]);
                i++;
            }
            blocks.push({ type: "mcq", content: mcqLines.join("\n") });
        } else {
            let textLines = [line];
            i++;
            while (
                i < lines.length &&
                !/tick|circle/i.test(lines[i]) &&
                !/^\s*-?\s*[a-dA-D][\s☐\[\.\)\-]/.test(lines[i])
                ) {
                textLines.push(lines[i]);
                i++;
            }
            blocks.push({ type: "text", content: textLines.join("\n") });
        }
    }

    const totalBlanks = blocks
        .filter((b) => b.type === "text")
        .reduce((acc, block) => acc + (block.content.match(blankRegex) || []).length, 0);

    const [keyAnswers, setKeyAnswers] = useState(new Array(totalBlanks).fill(""));
    const [selectedChoices, setSelectedChoices] = useState({});
    let inputCounter = 0;

    const handleInputChange = (index, value) => {
        const updated = [...keyAnswers];
        updated[index] = value;
        setKeyAnswers(updated);
    };

    const handleMCQInput = (qid, value) => {
        setSelectedChoices((prev) => ({ ...prev, [qid]: value }));
    };

    const renderTextBlock = (textBlock) => {
        const parts = textBlock.split(blankRegex);
        return parts.map((part, i) => {
            const isBlank = i % 2 === 1;

            if (isBlank) {
                const before = parts[i - 1]?.toLowerCase() || "";
                const exclude = excludedLabels.some((label) => before.includes(label));
                if (exclude) return <span key={`skip-${i}`}>__________</span>;

                const currentIndex = inputCounter++;
                return (
                    <input
                        key={`input-${currentIndex}`}
                        type="text"
                        value={keyAnswers[currentIndex]}
                        onChange={(e) => handleInputChange(currentIndex, e.target.value)}
                        style={{
                            margin: "0 5px",
                            padding: "4px 6px",
                            borderRadius: "4px",
                            border: "1px solid #ccc",
                            minWidth: "100px",
                        }}
                        placeholder={`Answer ${currentIndex + 1}`}
                    />
                );
            }
            return <span key={`text-${i}`}>{part}</span>;
        });
    };

    const renderMCQBlock = (block, qid) => {
        const lines = block.trim().split("\n");
        const questionText = lines[0];
        const options = lines.slice(1);

        return (
            <div key={qid} style={{ marginTop: "16px", marginBottom: "24px" }}>
                <p><strong>{questionText}</strong></p>
                <ul style={{ marginBottom: "8px", marginLeft: "20px" }}>
                    {options.map((line, i) => (
                        <li key={i}>{line}</li>
                    ))}
                </ul>
                <input
                    type="text"
                    value={selectedChoices[qid] || ""}
                    onChange={(e) => handleMCQInput(qid, e.target.value)}
                    placeholder="Type the correct answer (e.g. a, b or full text)"
                    style={{
                        marginLeft: "20px",
                        padding: "4px 6px",
                        borderRadius: "4px",
                        border: "1px solid #ccc",
                        minWidth: "200px",
                    }}
                />
            </div>
        );
    };

    const handleSubmitKey = async () => {
        setSaving(true);
        setSuccessMsg("");
        setErrorMsg("");

        const answerKey = [];
        let textAnswerIndex = 0;

        blocks.forEach((block, index) => {
            if (block.type === "text") {
                const matches = block.content.match(blankRegex) || [];
                matches.forEach(() => {
                    answerKey.push({
                        question_id: `t${textAnswerIndex}`,
                        type: "text",
                        expected_answer: keyAnswers[textAnswerIndex] || "",
                    });
                    textAnswerIndex++;
                });
            } else if (block.type === "mcq") {
                answerKey.push({
                    question_id: `q${index}`,
                    type: "mcq",
                    expected_answer: selectedChoices[`q${index}`] || "",
                    question: block.content.split("\n")[0],
                    options: block.content.split("\n").slice(1),
                });
            }
        });

        const examData = {
            title: "Math Midterm 2025",
            created_by: "prof123",
            answer_key: answerKey,
        };

        try {
            // NOTE: update the port/path to your real backend if needed
            const res = await fetch("http://localhost:5000/api/submit-answer-key", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(examData),
            });

            if (!res.ok) {
                const errText = await res.text();
                throw new Error(errText || `HTTP ${res.status}`);
            }

            // Success UI (no alert)
            setSuccessMsg("Correction uploaded successfully ✅ Redirecting…");
            setSaving(false);

            // Navigate to /Student after a short delay
            setTimeout(() => {
                navigate("/Student");
            }, 1200);
        } catch (err) {
            console.error("❌ Error saving exam:", err);
            setErrorMsg("Failed to save the correction key.");
            setSaving(false);
        }
    };

    return (
        <div style={{ padding: "20px", maxWidth: "900px", margin: "0 auto" }}>
            <h2>🧠 Correction Key Entry</h2>

            {/* Inline banners */}
            {successMsg && (
                <div
                    style={{
                        marginTop: 12,
                        marginBottom: 12,
                        padding: "10px 14px",
                        borderRadius: 8,
                        background: "#e8f7ee",
                        color: "#1c6b3a",
                        border: "1px solid #bfe8cf",
                        fontWeight: 600,
                    }}
                >
                    {successMsg}
                </div>
            )}
            {errorMsg && (
                <div
                    style={{
                        marginTop: 12,
                        marginBottom: 12,
                        padding: "10px 14px",
                        borderRadius: 8,
                        background: "#fdeaea",
                        color: "#a52828",
                        border: "1px solid #f3c2c2",
                        fontWeight: 600,
                    }}
                >
                    {errorMsg}
                </div>
            )}

            <section style={{ marginBottom: "20px" }}>
                <h4>📄 Detected Exam Text</h4>
                <div
                    style={{
                        background: "#f5f5f5",
                        padding: "15px",
                        borderRadius: "8px",
                        whiteSpace: "pre-wrap",
                        lineHeight: "1.6",
                    }}
                >
                    {blocks.map((block, index) =>
                        block.type === "text"
                            ? <span key={index}>{renderTextBlock(block.content)}</span>
                            : renderMCQBlock(block.content, `q${index}`)
                    )}
                </div>
            </section>

            <div style={{ display: "flex", gap: 12 }}>
                <button
                    onClick={() => navigate("/")}
                    disabled={saving}
                    style={{
                        padding: "10px 20px",
                        fontWeight: "bold",
                        backgroundColor: "#007bff",
                        color: "#fff",
                        border: "none",
                        borderRadius: "8px",
                        cursor: "pointer",
                        opacity: saving ? 0.7 : 1,
                    }}
                >
                    ⬅ Back to Upload
                </button>

                <button
                    onClick={handleSubmitKey}
                    disabled={saving}
                    style={{
                        padding: "10px 20px",
                        fontWeight: "bold",
                        backgroundColor: "#28a745",
                        color: "#fff",
                        border: "none",
                        borderRadius: "8px",
                        cursor: "pointer",
                        opacity: saving ? 0.7 : 1,
                    }}
                >
                    {saving ? "Saving…" : "✅ Save Answer Key"}
                </button>
            </div>
        </div>
    );
};

export default KeyPage;
