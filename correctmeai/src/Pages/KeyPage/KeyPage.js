// src/Pages/KeyPage/KeyPage.jsx
import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { authedFetch } from "../../JWT/api";

const LLAMA_BASE = process.env.REACT_APP_LLAMA_BASE || "http://localhost:5000";
const API_URL = `${LLAMA_BASE}/api/submit-answer-key`;

export default function KeyPage() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const extractedText = state?.extractedText || "";

  // Determine pages to save
  const pagesFromUpload = Array.isArray(state?.pages) ? state.pages : null;
  const pageMatches = Array.from(extractedText.matchAll(/🖼️\s*Page\s+(\d+)/gi));
  const pagesFromText = pageMatches.map((_, i) => ({ index: i + 1 }));
  const pagesToSave = pagesFromUpload?.length ? pagesFromUpload : pagesFromText;

  // UI state
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState("");

  // Parsing logic
  const blankRegex = /(\.{3,}|_{3,})/;
  const excludedLabels = ["name", "class", "number", "notes"];

  // Parse blocks (text vs MCQ)
  const blocks = [];
  const lines = extractedText.split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = (lines[i] || "").trim();

    if (/tick|circle/i.test(line)) {
      const buf = [line];
      i++;
      while (i < lines.length && /^\s*-?\s*[a-dA-D][\s☐\[\.\)\-]/.test(lines[i] || "")) {
        buf.push(lines[i]);
        i++;
      }
      blocks.push({ type: "mcq", content: buf.join("\n") });
    } else {
      const buf = [line];
      i++;
      while (
        i < lines.length &&
        !/tick|circle/i.test(lines[i] || "") &&
        !/^\s*-?\s*[a-dA-D][\s☐\[\.\)\-]/.test(lines[i] || "")
      ) {
        buf.push(lines[i]);
        i++;
      }
      blocks.push({ type: "text", content: buf.join("\n") });
    }
  }

  // Count blanks for input fields
  const totalBlanks = blocks
    .filter((b) => b.type === "text")
    .reduce((acc, b) => acc + (b.content.match(blankRegex) || []).length, 0);

  const [keyAnswers, setKeyAnswers] = useState(Array(totalBlanks).fill(""));
  const [selectedChoices, setSelectedChoices] = useState({});
  let inputCounter = 0;

  const handleInputChange = (idx, value) => {
    setKeyAnswers((prev) => {
      const updated = [...prev];
      updated[idx] = value;
      return updated;
    });
  };

  const handleMCQInput = (qid, value) => {
    setSelectedChoices((prev) => ({ ...prev, [qid]: value }));
  };

  const renderTextBlock = (textBlock) => {
    const parts = textBlock.split(blankRegex);
    return parts.map((part, idx) => {
      const isBlank = idx % 2 === 1;
      if (!isBlank) return <span key={`t-${idx}`}>{part}</span>;

      const before = (parts[idx - 1] || "").toLowerCase();
      const shouldExclude = excludedLabels.some((label) => before.includes(label));
      if (shouldExclude) return <span key={`skip-${idx}`}>__________</span>;

      const current = inputCounter++;
      return (
        <input
          key={`in-${current}`}
          type="text"
          value={keyAnswers[current] || ""}
          onChange={(e) => handleInputChange(current, e.target.value)}
          style={{
            margin: "0 5px",
            padding: "4px 6px",
            borderRadius: 6,
            border: "1px solid #ccc",
            minWidth: 100,
          }}
          placeholder={`Answer ${current + 1}`}
        />
      );
    });
  };

  const renderMCQBlock = (block, qid) => {
    const lines = block.trim().split("\n");
    const questionText = lines[0];
    const options = lines.slice(1);
    return (
      <div key={qid} style={{ marginTop: 16, marginBottom: 24 }}>
        <p>
          <strong>{questionText}</strong>
        </p>
        <ul style={{ marginBottom: 8, marginLeft: 20 }}>
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
            marginLeft: 20,
            padding: "4px 6px",
            borderRadius: 6,
            border: "1px solid #ccc",
            minWidth: 200,
          }}
        />
      </div>
    );
  };

  const onSaveClick = () => {
    setShowModal(true);
    setErrorMsg("");
  };

  const confirmSave = async () => {
    if (!title.trim()) {
      setErrorMsg("Please enter a title before saving.");
      return;
    }

    setSaving(true);
    setErrorMsg("");
    setSuccessMsg("");

    const answerKey = [];
    let textIdx = 0;

    blocks.forEach((block, index) => {
      if (block.type === "text") {
        const matches = block.content.match(blankRegex) || [];
        matches.forEach(() => {
          answerKey.push({
            question_id: `t${textIdx}`,
            type: "text",
            expected_answer: keyAnswers[textIdx] || "",
          });
          textIdx++;
        });
      } else if (block.type === "mcq") {
        answerKey.push({
          question_id: `q${index}`,
          type: "mcq_single",
          expected_answer: selectedChoices[`q${index}`] || "",
        });
      }
    });

    const payload = {
      title: title.trim(),
      answer_key: answerKey,
      pages: pagesToSave,
    };

    try {
      const response = await authedFetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let message = `HTTP ${response.status}`;
        try {
          const json = await response.json();
          if (json?.error) message = json.error;
        } catch {}
        throw new Error(message);
      }

      setShowModal(false);
      setSuccessMsg("Correction uploaded successfully ✅ Redirecting…");
      setTimeout(() => navigate("/Student"), 1200);
    } catch (err) {
      console.error("Save error:", err);
      setErrorMsg(err.message || "Failed to save the correction key.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 20, maxWidth: 900, margin: "0 auto" }}>
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

      <section style={{ marginBottom: 20 }}>
        <h4>📄 Detected Exam Text</h4>
        <div
          style={{
            background: "#f5f5f5",
            padding: 15,
            borderRadius: 8,
            whiteSpace: "pre-wrap",
            lineHeight: 1.6,
          }}
        >
          {blocks.map((block, idx) =>
            block.type === "text" ? (
              <span key={idx}>{renderTextBlock(block.content)}</span>
            ) : (
              renderMCQBlock(block.content, `q${idx}`)
            )
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
            borderRadius: 8,
            cursor: "pointer",
            opacity: saving ? 0.7 : 1,
          }}
        >
          ⬅ Back to Upload
        </button>

        <button
          onClick={onSaveClick}
          disabled={saving}
          style={{
            padding: "10px 20px",
            fontWeight: "bold",
            backgroundColor: "#28a745",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? "Saving…" : "✅ Save Answer Key"}
        </button>
      </div>

      {showModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
        >
          <div
            style={{
              width: "min(520px, 94vw)",
              background: "#fff",
              borderRadius: 12,
              boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
              padding: 20,
            }}
          >
            <h3 style={{ marginBottom: 12 }}>Save exam</h3>
            <label style={{ fontWeight: 600, display: "block", marginBottom: 6 }}>
              Exam title <span style={{ color: "#a52828" }}>*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Math Midterm 2025"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid #ccc",
                marginBottom: 10,
              }}
              autoFocus
            />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
              <button
                onClick={() => setShowModal(false)}
                disabled={saving}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: "1px solid #ddd",
                  background: "#fff",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmSave}
                disabled={saving}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: "none",
                  background: "#28a745",
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}