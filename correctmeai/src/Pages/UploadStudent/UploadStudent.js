// src/Pages/UploadStudent/UploadStudent.jsx
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ReactSortable } from "react-sortablejs";
import { authedFetch, GRADER_BASE } from "../../JWT/api";
import "./UploadStudent.css";

/** Services
 *  - Main backend (auth + exams): GRADER_BASE (e.g., http://localhost:5006)
 *  - Student/OCR service: OCR_BASE (e.g., http://localhost:5001)
 */
const OCR_BASE = process.env.REACT_APP_OCR_BASE || "http://localhost:5001";

export default function UploadStudent() {
    const navigate = useNavigate();
    const fileInputRef = useRef(null);

    // Files
    const [filesWithIndex, setFilesWithIndex] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // Exams
    const [exams, setExams] = useState([]);
    const [selectedExamId, setSelectedExamId] = useState("");

    // ---------- Load current user's exams ----------
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                setError("");
                const r = await authedFetch(`${GRADER_BASE}/api/exams`);
                const j = await r.json();
                if (!r.ok) throw new Error(j?.error || `Failed to load exams (${r.status})`);
                if (!alive) return;
                setExams(Array.isArray(j) ? j : []);
                if (Array.isArray(j) && j.length && !selectedExamId) {
                    setSelectedExamId(j[0]._id);
                }
            } catch (e) {
                if (alive) setError(e.message || "Failed to load exams.");
            }
        })();
        return () => { alive = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ---------- File handlers ----------
    const handleFileChange = (event) => {
        const selectedFiles = Array.from(event.target.files || []);
        const newFiles = selectedFiles.map((file, idx) => ({
            id: `${file.name}-${Date.now()}-${idx}`,
            file,
            preview: URL.createObjectURL(file),
            order: idx + 1,
        }));
        setFilesWithIndex(newFiles);
        setError("");
    };

    const handleDrop = (event) => {
        event.preventDefault();
        event.stopPropagation();
        const droppedFiles = Array.from(event.dataTransfer.files || []);
        const newFiles = droppedFiles.map((file, idx) => ({
            id: `${file.name}-${Date.now()}-${idx}`,
            file,
            preview: URL.createObjectURL(file),
            order: idx + 1,
        }));
        setFilesWithIndex(newFiles);
        setError("");
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleClear = () => {
        filesWithIndex.forEach((f) => URL.revokeObjectURL(f.preview));
        setFilesWithIndex([]);
        setError("");
    };


    // ---------- Submit flow ----------
    const handleSubmit = async () => {
        if (!selectedExamId) {
            setError("Please choose an exam to attach this submission to.");
            return;
        }
        if (filesWithIndex.length === 0) return;

        setLoading(true);
        setError("");

        try {
            // 1) OCR first page (your OCR endpoint accepts one file)
            const first = filesWithIndex[0];
            const fd = new FormData();
            fd.append("files", first.file);

            const ocrRes = await fetch(`${OCR_BASE}/extract-answers`, {
                method: "POST",
                body: fd,
            });
            const ocr = await ocrRes.json();
            if (!ocrRes.ok) throw new Error(ocr?.error || "Failed to extract answers.");

            const student = ocr.student_name || ocr.student_id || "Unknown Student";
            const answers = ocr.answers || ocr.answers_structured || {};

            // 2) Save submission to student service
            const saveRes = await fetch(`${OCR_BASE}/api/submit-student`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    student_id: student,
                    exam_id: selectedExamId, // string → server casts to ObjectId
                    answers_structured: answers,
                }),
            });
            const saved = await saveRes.json();
            if (!saveRes.ok || !saved?.submission_id) {
                throw new Error(saved?.error || "Failed to save submission.");
            }

            // 3) Go to Result page
            navigate(`/result/${saved.submission_id}`);
        } catch (e) {
            console.error(e);
            setError(e.message || "Upload failed.");
            alert(`❌ ${e.message || "Upload failed."}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="page-wrapper">
            <div className="container" onDragOver={handleDragOver} onDrop={handleDrop}>
                {/* Exam picker row */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                    <div style={{ fontWeight: 700, width: 120, textAlign: "right" }}>Attach to exam:</div>

                    <select
                        value={selectedExamId || ""}
                        onChange={(e) => setSelectedExamId(e.target.value)}
                        className="input"
                        style={{ minWidth: 260 }}
                    >
                        {!exams.length && <option value="">— no exams yet —</option>}
                        {exams.map((ex) => (
                            <option key={ex._id} value={ex._id}>
                                {/* ✅ NO "(key ready)" suffix here — only title */}
                                {ex.title}
                            </option>
                        ))}
                    </select>

                </div>

                {/* Drop zone / gallery */}
                <div
                    className="header full-gallery"
                    onClick={() => fileInputRef.current && fileInputRef.current.click()}
                >
                    {filesWithIndex.length === 0 ? (
                        <>
                            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path
                                    d="M7 10V9C7 6.23858 9.23858 4 12 4C14.7614 4 17 6.23858 17 9V10C19.2091 10 21 11.7909 21 14C21 15.4806 20.1956 16.8084 19 17.5M7 10C4.79086 10 3 11.7909 3 14C3 15.4806 3.8044 16.8084 5 17.5M7 10C7.43285 10 7.84965 10.0688 8.24006 10.1959M12 12V21M12 12L15 15M12 12L9 15"
                                    stroke="#000000"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                            <p>Browse or drag multiple images to upload!</p>
                        </>
                    ) : (
                        <>
                            <p style={{ textAlign: "center", fontSize: 14, marginBottom: 8, color: "#333" }}>
                                🟰 Drag the images to reorder them before submitting
                            </p>
                            <ReactSortable list={filesWithIndex} setList={setFilesWithIndex} className="header-gallery">
                                {filesWithIndex.map((item, index) => (
                                    <div
                                        key={item.id}
                                        className="image-wrapper"
                                        style={{ textAlign: "center", cursor: "grab", position: "relative" }}
                                    >
                                        <div className="image-index">{index + 1}</div>
                                        <img src={item.preview} alt={`Image ${index + 1}`} className="header-image-multiple" />
                                    </div>
                                ))}
                            </ReactSortable>
                        </>
                    )}
                </div>

                {/* Footer row (filename + clear) */}
                <div className="footer">
                    <svg fill="#000000" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" style={{ width: 24, height: 24 }}>
                        <path d="M15.331 6H8.5v20h15V14.154h-8.169z" />
                        <path d="M18.153 6h-.009v5.342H23.5v-.002z" />
                    </svg>

                    <label htmlFor="file" style={{ flex: 1, textAlign: "center", cursor: "pointer" }}>
                        {filesWithIndex.length > 0 ? `${filesWithIndex.length} file(s) selected` : "Not selected file"}
                    </label>

                    <span onClick={handleClear} style={{ cursor: "pointer", paddingLeft: 8 }} title="Clear selection">
            <svg viewBox="0 0 24 24" fill="none" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
              <path
                  d="M5.16565 10.1534C5.07629 8.99181 5.99473 8 7.15975 8H16.8402C18.0053 8 18.9237 8.9918 18.8344 10.1534L18.142 19.1534C18.0619 20.1954 17.193 21 16.1479 21H7.85206C6.80699 21 5.93811 20.1954 5.85795 19.1534L5.16565 10.1534Z"
                  stroke="#000000"
                  strokeWidth="2"
              />
              <path d="M19.5 5H4.5" stroke="#000000" strokeWidth="2" strokeLinecap="round" />
              <path
                  d="M10 3C10 2.44772 10.4477 2 11 2H13C13.5523 2 14 2.44772 14 3V5H10V3Z"
                  stroke="#000000"
                  strokeWidth="2"
              />
            </svg>
          </span>
                </div>

                {/* Hidden file input */}
                <input
                    id="file"
                    type="file"
                    accept="image/*"
                    multiple
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    style={{ display: "none" }}
                />

                {/* Submit */}
                <button
                    onClick={handleSubmit}
                    style={{
                        marginTop: 10,
                        padding: "10px 20px",
                        fontWeight: "bold",
                        backgroundColor: "#007bff",
                        color: "#fff",
                        border: "none",
                        borderRadius: 8,
                        cursor: "pointer",
                    }}
                    disabled={loading || filesWithIndex.length === 0}
                >
                    {loading ? "Submitting..." : "Submit"}
                </button>

                {error && <p style={{ color: "red", marginTop: 10 }}>❌ {error}</p>}
            </div>
        </div>
    );
}
