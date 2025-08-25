// src/Pages/Result/Result.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, Link, useNavigate } from "react-router-dom"; // ⬅ add useNavigate
import "./Result.css";
import { GRADER_BASE, SUB_API, authedFetch } from "../../JWT/api";

export default function Result() {
    const { submissionId } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate(); // ⬅ add
    const student = searchParams.get("student");

    const [data, setData] = useState(null);
    const [exam, setExam] = useState(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");

    useEffect(() => {
        let alive = true;
        async function fetchData() {
            try {
                setLoading(true);
                setErr("");

                let sub;

                if (submissionId && submissionId !== "undefined") {
                    // fetch submission from the corrector server (:5005 / SUB_API)
                    const r = await authedFetch(
                        `${SUB_API}/submissions/${encodeURIComponent(submissionId)}`
                    );
                    if (!r.ok) throw new Error(`Failed to fetch submission (${r.status})`);
                    sub = await r.json();
                } else {
                    const qs = student ? `?student_id=${encodeURIComponent(student)}` : "";
                    const r = await authedFetch(`${SUB_API}/submissions/latest${qs}`);
                    if (!r.ok) throw new Error(`No latest submission found (${r.status})`);
                    sub = await r.json();
                }

                if (!alive) return;
                setData(sub);

                // fetch exam info from the main server (:5006)
                if (sub?.exam_id) {
                    const rex = await authedFetch(
                        `${GRADER_BASE}/api/exams/${encodeURIComponent(sub.exam_id)}`
                    );
                    if (rex.ok) {
                        const ex = await rex.json();
                        if (alive) setExam(ex);
                    }
                }
            } catch (e) {
                if (alive) setErr(e.message || "Error");
            } finally {
                if (alive) setLoading(false);
            }
        }

        fetchData();
        return () => {
            alive = false;
        };
    }, [submissionId, student]);

    const total = data?.score ?? null;
    const feedback = data?.feedback || "";
    const details = Array.isArray(data?.grading_details) ? data.grading_details : [];
    const percent = useMemo(
        () => (total == null ? null : Math.round((total / 20) * 100)),
        [total]
    );

    if (loading) return <div className="page pad text-muted">Loading result…</div>;
    if (err) return <div className="page pad text-error">Error: {err}</div>;
    if (!data) return <div className="page pad">No data found.</div>;

    const gradeClass =
        percent == null
            ? "badge--neutral"
            : percent >= 85
                ? "badge--emerald"
                : percent >= 70
                    ? "badge--green"
                    : percent >= 50
                        ? "badge--amber"
                        : "badge--rose";

    const barClass = percent >= 50 ? "bar--ok" : "bar--bad";

    // exam id for the Grades page & for new submissions
    const examId = data?.exam_id || exam?._id;

    return (
        <div className="page">
            <div className="container">
                <div className="card">
                    {/* Header */}
                    <header className="card__header">
                        <div className="head-left">
                            <h1 className="title">{exam?.title || "Exam Result"}</h1>
                            <div className="meta">
                                <div>
                                    Student:{" "}
                                    <span className="meta__value">{data.student_id || "—"}</span>
                                </div>
                            </div>
                        </div>

                        {percent !== null && (
                            <div className="score">
                                <div className="score__label">Score (/20)</div>
                                <div className="score__value">{total?.toFixed(2)}</div>
                                <div className={`badge ${gradeClass}`}>
                                    <strong>{percent}%</strong>&nbsp;overall
                                </div>

                                <div className="progress">
                                    <div className={`bar ${barClass}`} style={{ width: `${percent}%` }} />
                                </div>
                                <div className="progress__caption">Progress</div>
                            </div>
                        )}
                    </header>

                    {/* Feedback */}
                    {feedback && (
                        <section className="section pad">
                            <div className="feedback">
                                <div className="label">Feedback</div>
                                <p className="feedback__text">{feedback}</p>
                            </div>
                        </section>
                    )}

                    {/* Details */}
                    <section className="section">
                        <div className="section__head pad between">
                            <div className="section__title">Grading details</div>
                            <div className="text-muted">{details.length} items</div>
                        </div>

                        <div className="table-wrap">
                            <table className="table">
                                <thead>
                                <tr>
                                    <th>Question</th>
                                    <th>Type</th>
                                    <th>Expected</th>
                                    <th>Student</th>
                                    <th className="right">Points</th>
                                    <th className="right">Awarded</th>
                                    <th>Comment</th>
                                </tr>
                                </thead>
                                <tbody>
                                {details.map((d, idx) => {
                                    const ok = d.awarded >= d.points - 1e-9;
                                    return (
                                        <tr key={idx}>
                                            <td className="strong">{d.question_id || `#${d.index}`}</td>
                                            <td className="muted">{d.type}</td>
                                            <td>
                                                <span className="chip">{fmt(d.expected)}</span>
                                            </td>
                                            <td>
                                                <span className="chip">{fmt(d.student)}</span>
                                            </td>
                                            <td className="right">{round2(d.points)}</td>
                                            <td className="right">
                          <span className={`pill ${ok ? "pill--ok" : "pill--bad"}`}>
                            {round2(d.awarded)}
                          </span>
                                            </td>
                                            <td className="muted">{d.comment}</td>
                                        </tr>
                                    );
                                })}
                                </tbody>
                            </table>
                        </div>

                        <div className="actions pad no-print">
                            {/* View Grades for this exam */}
                            {examId && (
                                <Link
                                    to={`/exam/${encodeURIComponent(examId)}/grades`}
                                    className="btn btn--dark"
                                >
                                    View all grades
                                </Link>
                            )}

                            {/* NEW: Add submission button */}
                            <button
                                className="btn btn--ghost"
                                onClick={() =>
                                    navigate("/student", {
                                        state: { examId, examTitle: exam?.title || undefined },
                                    })
                                }
                                disabled={!examId}
                                title={examId ? "Add a new submission to this exam" : "Exam id unknown"}
                            >
                                + New submission
                            </button>

                            <button onClick={() => window.print()} className="btn btn--dark">
                                Print / Save PDF
                            </button>

                            <button
                                onClick={async () => {
                                    try {
                                        const id =
                                            data?._id || (submissionId !== "undefined" ? submissionId : null);
                                        if (!id) return;

                                        // regrade on corrector server (POST preferred)
                                        await authedFetch(
                                            `${SUB_API}/submissions/${encodeURIComponent(id)}/regrade`,
                                            { method: "POST" }
                                        );

                                        // refetch the submission from corrector
                                        const res = await authedFetch(
                                            `${SUB_API}/submissions/${encodeURIComponent(id)}`
                                        );
                                        if (res.ok) setData(await res.json());
                                    } catch {
                                        /* ignore */
                                    }
                                }}
                                className="btn btn--primary"
                            >
                                Recalculate score
                            </button>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}

function fmt(v) {
    if (v === null || v === undefined) return "—";
    if (typeof v === "string") return v;
    try {
        return JSON.stringify(v);
    } catch {
        return String(v);
    }
}
function round2(n) {
    if (n === null || n === undefined) return "0.00";
    return Number(n).toFixed(2);
}
