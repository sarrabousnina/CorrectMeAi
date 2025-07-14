import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";

import "./UploadExam.css";

const UploadExam = () => {
    const [files, setFiles] = useState([]);
    const [imagePreviews, setImagePreviews] = useState([]);
    const [extractedText, setExtractedText] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const fileInputRef = useRef(null);
    const navigate = useNavigate();


    const handleFileChange = (event) => {
        const selectedFiles = Array.from(event.target.files);
        const previews = selectedFiles.map((file) => URL.createObjectURL(file));
        setFiles(selectedFiles);
        setImagePreviews(previews);
        setExtractedText("");
        setError("");
    };

    const handleDragOver = (event) => {
        event.preventDefault();
        event.stopPropagation();
    };

    const handleDrop = (event) => {
        event.preventDefault();
        event.stopPropagation();
        const droppedFiles = Array.from(event.dataTransfer.files);
        const previews = droppedFiles.map((file) => URL.createObjectURL(file));
        setFiles(droppedFiles);
        setImagePreviews(previews);
        setExtractedText("");
        setError("");
    };

    const handleSubmit = async () => {
        if (files.length === 0) return;
        setLoading(true);
        setError("");

        let finalText = "";

        for (let file of files) {
            const formData = new FormData();
            formData.append("file", file);

            try {
                const response = await fetch("http://localhost:5000/extract", {
                    method: "POST",
                    body: formData,
                });

                const data = await response.json();

                if (response.ok) {
                    finalText += `📄 From: ${file.name}\n${data.text}\n\n`;
                } else {
                    finalText += `❌ Error with ${file.name}: ${data.error || "Failed to extract"}\n\n`;
                }
            } catch (err) {
                finalText += `❌ Server error with ${file.name}\n\n`;
            }
        }

        setLoading(false);
        navigate("/key", { state: { extractedText: finalText } }); // go to KeyPage with data
    };
    return (
        <div className="page-wrapper">
            <div className="container" onDragOver={handleDragOver} onDrop={handleDrop}>
                <div
                    className="header full-gallery"
                    onClick={() => fileInputRef.current && fileInputRef.current.click()}
                >
                    {imagePreviews.length === 0 ? (
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
                        <div className="header-gallery">
                            {imagePreviews.map((src, index) => (
                                <img
                                    key={index}
                                    src={src}
                                    alt={`Preview ${index + 1}`}
                                    className="header-image-multiple"
                                />
                            ))}
                        </div>
                    )}
                </div>


                <div className="footer">
                    <svg fill="#000000" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"
                         style={{width: "24px", height: "24px"}}>
                        <path d="M15.331 6H8.5v20h15V14.154h-8.169z"/>
                        <path d="M18.153 6h-.009v5.342H23.5v-.002z"/>
                    </svg>

                    <label htmlFor="file" style={{flex: 1, textAlign: "center", cursor: "pointer"}}>
                        {files.length > 0 ? `${files.length} file(s) selected` : "Not selected file"}
                    </label>

                    <span
                        onClick={() => {
                            setFiles([]);
                            setImagePreviews([]);
                            setExtractedText("");
                            setError("");
                        }}
                        style={{cursor: "pointer", paddingLeft: "8px"}}
                        title="Clear selection"
                    >
            <svg viewBox="0 0 24 24" fill="none" width="24px" height="24px" xmlns="http://www.w3.org/2000/svg">
              <path
                  d="M5.16565 10.1534C5.07629 8.99181 5.99473 8 7.15975 8H16.8402C18.0053 8 18.9237 8.9918 18.8344 10.1534L18.142 19.1534C18.0619 20.1954 17.193 21 16.1479 21H7.85206C6.80699 21 5.93811 20.1954 5.85795 19.1534L5.16565 10.1534Z"
                  stroke="#000000"
                  strokeWidth="2"
              />
              <path d="M19.5 5H4.5" stroke="#000000" strokeWidth="2" strokeLinecap="round"/>
              <path
                  d="M10 3C10 2.44772 10.4477 2 11 2H13C13.5523 2 14 2.44772 14 3V5H10V3Z"
                  stroke="#000000"
                  strokeWidth="2"
              />
            </svg>
          </span>
                </div>

                <input
                    id="file"
                    type="file"
                    accept="image/*"
                    multiple
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    style={{display: "none"}}
                />


                <button
                    onClick={handleSubmit}
                    style={{
                        marginTop: "10px",
                        padding: "10px 20px",
                        fontWeight: "bold",
                        backgroundColor: "#007bff",
                        color: "#fff",
                        border: "none",
                        borderRadius: "8px",
                        cursor: "pointer",
                    }}
                    disabled={loading || files.length === 0}
                >
                    {loading ? "Submitting..." : "Submit"}
                </button>

                {error && <p style={{color: "red", marginTop: "10px"}}>❌ {error}</p>}

            </div>
        </div>
    );
};

export default UploadExam;
