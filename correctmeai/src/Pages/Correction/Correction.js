import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const Correction = () => {
    const location = useLocation();
    const navigate = useNavigate();

    const answers = location.state?.answers || null;
    const studentFile = location.state?.studentFile || "unknown file";

    const [studentId, setStudentId] = useState("");
    const [examId, setExamId] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [score, setScore] = useState(null);
    const [feedback, setFeedback] = useState("");

    const handleSaveToDB = async () => {
        if (!studentId || !examId) {
            alert("Please enter both student ID and exam ID.");
            return;
        }

        if (!answers || typeof answers !== "object") {
            alert("Answers are not structured correctly.");
            return;
        }

        setIsSaving(true);
        try {
            const response = await fetch("http://localhost:5001/api/submit-student", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    student_id: studentId,
                    exam_id: examId,
                    answers_structured: answers,
                }),
            });

            const data = await response.json();
            if (response.ok) {
                localStorage.setItem("lastSubmissionId", data.submission_id);
                alert("✅ Student submission saved!\nID: " + data.submission_id);
            } else {
                alert("❌ Failed to save: " + (data.error || "Unknown error"));
            }
        } catch (err) {
            console.error("❌ Error saving:", err);
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
            const res = await fetch(`http://localhost:5001/api/score-submission/${submissionId}`, {
                method: "POST",
            });

            const data = await res.json();
            if (res.ok) {
                setScore(data.score);
                setFeedback(data.feedback);
                alert(`✅ Scored ${data.score}/20\n📝 Feedback:\n${data.feedback}`);
            } else {
                alert("❌ Error scoring: " + (data.error || "Unknown issue"));
                console.error(data.raw);
            }
        } catch (err) {
            console.error("❌ Network error:", err);
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
                    }}
                >
                    {answers ? (
                        <pre>{JSON.stringify(answers, null, 2)}</pre>
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
                    placeholder="📝 Exam ID (Mongo ObjectId)"
                    value={examId}
                    onChange={(e) => setExamId(e.target.value)}
                    style={{ padding: "8px", width: "100%" }}
                />
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
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
                        backgroundColor: "#28a745",
                        color: "#fff",
                        border: "none",
                        borderRadius: "8px",
                        cursor: "pointer",
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
                    }}
                >
                    🧠 Score Now
                </button>
            </div>

            {score !== null && (
                <div style={{ marginTop: "20px", background: "#e9ffe9", padding: "15px", borderRadius: "8px" }}>
                    <h4>✅ Score: {score} / 20</h4>
                    <p><strong>📝 Feedback:</strong> {feedback}</p>
                </div>
            )}
        </div>
    );
};

export default Correction;
