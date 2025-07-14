import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const KeyPage = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const extractedText = location.state?.extractedText || "";

    // Pattern to detect blanks
    const blankRegex = /(\.{3,}|_{3,})/g;

    // Define labels to exclude from being turned into inputs
    const excludedLabels = ["name", "class", "number", "notes"];

    const matches = [...extractedText.matchAll(blankRegex)];

    const [keyAnswers, setKeyAnswers] = useState(
        new Array(matches.length).fill("")
    );

    const handleInputChange = (index, value) => {
        const updated = [...keyAnswers];
        updated[index] = value;
        setKeyAnswers(updated);
    };

    const renderWithInputs = () => {
        const segments = extractedText.split(blankRegex);
        let inputIndex = 0;

        return segments.map((segment, i) => {
            const isBlank = i % 2 === 1;

            if (isBlank) {
                const precedingText = segments[i - 1]?.toLowerCase() || "";

                const shouldExclude = excludedLabels.some((label) =>
                    precedingText.includes(label)
                );

                if (shouldExclude) {
                    return <span key={`skip-${i}`}>_________</span>;
                }

                const index = inputIndex++;
                return (
                    <input
                        key={`input-${index}`}
                        type="text"
                        value={keyAnswers[index]}
                        onChange={(e) => handleInputChange(index, e.target.value)}
                        style={{
                            margin: "0 5px",
                            padding: "4px 6px",
                            borderRadius: "4px",
                            border: "1px solid #ccc",
                            minWidth: "100px",
                        }}
                        placeholder={`Answer ${index + 1}`}
                    />
                );
            } else {
                return <span key={`text-${i}`}>{segment}</span>;
            }
        });
    };

    return (
        <div style={{ padding: "20px", maxWidth: "900px", margin: "0 auto" }}>
            <h2>🧠 Correction Key Entry</h2>

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
                    {renderWithInputs()}
                </div>
            </section>

            <button
                onClick={() => navigate("/")}
                style={{
                    marginTop: "20px",
                    padding: "10px 20px",
                    fontWeight: "bold",
                    backgroundColor: "#007bff",
                    color: "#fff",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                }}
            >
                ⬅ Back to Upload
            </button>
        </div>
    );
};

export default KeyPage;
