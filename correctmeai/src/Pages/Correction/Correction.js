import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { GRADER_BASE, SUB_API, authedFetch } from "../../JWT/api";

const Correction = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const studentName = location.state?.studentName || "";
  const answers = location.state?.answers || null;
  const studentFile = location.state?.studentFile || "unknown file";

  const [studentId, setStudentId] = useState(studentName);
  const [examId, setExamId] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [score, setScore] = useState(null);
  const [feedback, setFeedback] = useState("");

  // Fetch latest exam on mount
  useEffect(() => {
    const fetchLatestExam = async () => {
      try {
        const res = await fetch(`${GRADER_BASE}/api/exams/latest`);
        const data = await res.json();
        if (res.ok) {
          setExamId(data.id);
        } else {
          console.error("Failed to fetch latest exam:", data.error);
        }
      } catch (err) {
        console.error("Network error while fetching latest exam", err);
      }
    };

    fetchLatestExam();
  }, []);

  const handleSaveToDB = async () => {
    if (!studentId.trim() || !examId) {
      alert("Please enter both student ID and exam ID.");
      return;
    }

    if (!answers || typeof answers !== "object") {
      alert("Answers are not structured correctly.");
      return;
    }

    setIsSaving(true);
    try {
      const response = await authedFetch(`${GRADER_BASE}/api/submit-student`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_name: studentId.trim(),
          exam_id: examId,
          answers_structured: answers,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        localStorage.setItem("lastSubmissionId", data.submission_id);
        alert(`✅ Student submission saved!\nID: ${data.submission_id}`);
      } else {
        alert(`❌ Failed to save: ${data.error || "Unknown error"}`);
      }
    } catch (err) {
      console.error("Error saving submission:", err);
      alert("❌ Server error while saving submission.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleScore = async () => {
    const submissionId = localStorage.getItem("lastSubmissionId");
    if (!submissionId) {
      alert("Submission ID not found. Please save first.");
      return;
    }

    try {
      const res = await fetch(`${SUB_API}/submissions/${submissionId}/regrade`, {
        method: "POST",
      });

      const data = await res.json();
      if (res.ok) {
        setScore(data.score);
        setFeedback(data.feedback);
        alert(`✅ Scored ${data.score}/20\n📝 Feedback:\n${data.feedback}`);
      } else {
        alert(`❌ Error scoring: ${data.error || "Unknown issue"}`);
        console.error("Scoring error:", data);
      }
    } catch (err) {
      console.error("Network error during scoring:", err);
      alert("❌ Failed to connect to backend.");
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: "900px", margin: "0 auto" }}>
      <h2>📋 Student Answer Preview</h2>

      <section style={{ marginBottom: "20px" }}>
        <h4>🖼️ From: {studentFile}</h4>
        <h4>📄 Detected Exam Text</h4>
        <div
          style={{
            background: "#f5f5f5",
            padding: "15px",
            borderRadius: "8px",
            whiteSpace: "pre-wrap",
            lineHeight: "1.6",
            maxHeight: "500px",
            overflow: "auto",
            fontFamily: "monospace",
          }}
        >
          {answers ? (
            <code>{JSON.stringify(answers, null, 2)}</code>
          ) : (
            <p style={{ color: "red" }}>❌ No valid answers found to display.</p>
          )}
        </div>
      </section>

      <div style={{ marginBottom: "10px" }}>
        <input
          type="text"
          placeholder="👤 Student ID"
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          style={{ padding: "8px", width: "100%", marginBottom: "10px" }}
        />
        <input
          type="text"
          value={examId}
          readOnly
          placeholder="📝 Auto-linked to last uploaded exam"
          style={{
            padding: "8px",
            width: "100%",
            backgroundColor: "#e9ecef",
            cursor: "not-allowed",
          }}
        />
      </div>

      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
        <button
          onClick={() => navigate("/")}
          style={{
            padding: "10px 20px",
            fontWeight: "bold",
            backgroundColor: "#6c757d",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            flex: "1",
            minWidth: "120px",
          }}
        >
          ⬅ Back to Upload
        </button>

        <button
          onClick={handleSaveToDB}
          disabled={isSaving}
          style={{
            padding: "10px 20px",
            fontWeight: "bold",
            backgroundColor: isSaving ? "#6c757d" : "#28a745",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            cursor: isSaving ? "not-allowed" : "pointer",
            flex: "1",
            minWidth: "120px",
          }}
        >
          {isSaving ? "Saving..." : "✅ Save to Database"}
        </button>

        <button
          onClick={handleScore}
          style={{
            padding: "10px 20px",
            fontWeight: "bold",
            backgroundColor: "#ffc107",
            color: "#000",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            flex: "1",
            minWidth: "120px",
          }}
        >
          🧠 Score Now
        </button>
      </div>

      {score !== null && (
        <div
          style={{
            marginTop: "20px",
            background: "#e9ffe9",
            padding: "15px",
            borderRadius: "8px",
            borderLeft: "4px solid #28a745",
          }}
        >
          <h4>✅ Score: {score} / 20</h4>
          <p>
            <strong>📝 Feedback:</strong> {feedback}
          </p>
        </div>
      )}
    </div>
  );
};

export default Correction;