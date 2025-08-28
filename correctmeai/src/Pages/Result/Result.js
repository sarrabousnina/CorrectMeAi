import React, { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, Link, useNavigate } from "react-router-dom";
import "./Result.css";
import { GRADER_BASE, SUB_API, authedFetch } from "../../JWT/api";

function PointsCell({ row }) {
    return (
        <div>
            {/* RAW question total */}
            <div className="font-semibold">{Number(row.points ?? 0).toFixed(2)}</div>

            {/* RAW per-input steps (1 / 0.5 / 0.25) */}
            {Array.isArray(row.subparts) && row.subparts.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                    {row.subparts.map((sp) => (
                        <span
                            key={sp.sub_id}
                            className="inline-block border rounded-full px-2 py-0.5 text-xs"
                            title={`sub ${sp.sub_id}: ${Number(sp.points ?? 0).toFixed(2)} pts`}
                        >
              {sp.sub_id}: {Number(sp.points ?? 0).toFixed(2)}
            </span>
                    ))}
                </div>
            )}
        </div>
    );
}

function AwardedCell({ row }) {
    const ok = (row.awarded ?? 0) >= (row.points ?? 0) - 1e-9;
    return (
        <div>
            {/* RAW question awarded */}
            <span className={`pill ${ok ? "pill--ok" : "pill--bad"}`}>
        {Number(row.awarded ?? 0).toFixed(2)}
      </span>

            {/* RAW per-input awarded */}
            {Array.isArray(row.subparts) && row.subparts.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                    {row.subparts.map((sp) => (
                        <span
                            key={sp.sub_id}
                            className={
                                "inline-block rounded-full px-2 py-0.5 text-xs border " +
                                ((sp.awarded ?? 0) > 0
                                    ? "bg-green-100 border-green-300"
                                    : "bg-red-100 border-red-300")
                            }
                            title={`sub ${sp.sub_id}: ${Number(sp.awarded ?? 0).toFixed(2)} / ${Number(sp.points ?? 0).toFixed(2)}`}
                        >
              {sp.sub_id}: {Number(sp.awarded ?? 0).toFixed(2)}
            </span>
                    ))}
                </div>
            )}
        </div>
    );
}

function CommentCell({ row }) {
    if (Array.isArray(row.subparts) && row.subparts.length > 0) {
        return (
            <ul className="m-0 p-0 list-none text-xs text-gray-500">
                {row.subparts.map((sp) => (
                    <li key={sp.sub_id}>
                        <strong>{sp.sub_id}</strong>: {sp.comment ?? ""}
                    </li>
                ))}
            </ul>
        );
    }
    return <span className="muted">{row.comment}</span>;
}

export default function Result() {
    const { submissionId } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
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
                    const r = await authedFetch(`${SUB_API}/submissions/${encodeURIComponent(submissionId)}`);
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

                if (sub?.exam_id) {
                    const rex = await authedFetch(`${GRADER_BASE}/api/exams/${encodeURIComponent(sub.exam_id)}`);
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

    const total = data?.score ?? null; // this is the /20, now snapped to .25
    const feedback = data?.feedback || "";
    const details = Array.isArray(data?.grading_details) ? data.grading_details : [];
    const percent = useMemo(() => (total == null ? null : Math.round((total / 20) * 100)), [total]);

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
                                <div className="score__value">{Number(total ?? 0).toFixed(2)}</div>
                                <div className={`badge ${gradeClass}`}>
                                    <strong>{percent}%</strong>&nbsp;overall
                                </div>

                                <div className="progress">
                                    <div className={`bar ${barClass}`} style={{width: `${percent}%`}}/>
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
                                    <th className="right">Points (raw)</th>
                                    <th className="right">Awarded (raw)</th>
                                    <th>Comment</th>
                                </tr>
                                </thead>
                                <tbody>
                                {details.map((d, idx) => (
                                    <tr key={idx}>
                                        <td className="strong">{d.question_id || `#${d.index}`}</td>
                                        <td className="muted">{d.type}</td>
                                        <td><span className="chip">{fmt(d.expected)}</span></td>
                                        <td><span className="chip">{fmt(d.student)}</span></td>
                                        <td className="right"><PointsCell row={d} /></td>
                                        <td className="right"><AwardedCell row={d} /></td>
                                        <td><CommentCell row={d} /></td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="actions pad no-print">
                            {examId && (
                                <Link
                                    to={`/exam/${encodeURIComponent(examId)}/grades`}
                                    className="btn btn--dark"
                                >
                                    View all grades
                                </Link>
                            )}

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
                                        const id = data?._id || (submissionId !== "undefined" ? submissionId : null);
                                        if (!id) return;

                                        await authedFetch(
                                            `${SUB_API}/submissions/${encodeURIComponent(id)}/regrade`,
                                            { method: "POST" }
                                        );

                                        const res = await authedFetch(
                                            `${SUB_API}/submissions/${encodeURIComponent(id)}`
                                        );
                                        if (res.ok) setData(await res.json());
                                    } catch {/* ignore */}
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
    try { return JSON.stringify(v); } catch { return String(v); }
}
