import React, { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:5005";

export default function Result() {
    const { submissionId } = useParams();           // optional
    const [searchParams] = useSearchParams();
    const student = searchParams.get("student");    // optional

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

                // Case 1: explicit id in the URL
                if (submissionId && submissionId !== "undefined") {
                    const r = await fetch(`${API_BASE}/api/submissions/${submissionId}`);
                    if (!r.ok) throw new Error(`Failed to fetch submission (${r.status})`);
                    sub = await r.json();
                } else {
                    // Case 2: latest for a student (by query param), or global latest
                    const qs = student ? `?student_id=${encodeURIComponent(student)}` : "";
                    const r = await fetch(`${API_BASE}/api/submissions/latest${qs}`);
                    if (!r.ok) throw new Error(`No latest submission found (${r.status})`);
                    sub = await r.json();
                }

                if (!alive) return;
                setData(sub);

                if (sub?.exam_id) {
                    const rex = await fetch(`${API_BASE}/api/exams/${sub.exam_id}`);
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
        return () => { alive = false; };
    }, [submissionId, student]);

    const total = data?.score ?? null;
    const feedback = data?.feedback || "";
    const details = Array.isArray(data?.grading_details) ? data.grading_details : [];
    const percent = useMemo(
        () => (total == null ? null : Math.round((total / 20) * 100)),
        [total]
    );

    if (loading) return <div className="p-6 text-gray-500">Loading result…</div>;
    if (err) return <div className="p-6 text-red-600">Error: {err}</div>;
    if (!data) return <div className="p-6">No data found.</div>;

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold">
                        {exam?.title || "Exam Result"}
                    </h1>
                    <p className="text-sm text-gray-500">
                        Student: <span className="font-medium">{data.student_id || "—"}</span>
                    </p>
                    <p className="text-sm text-gray-500">
                        Submission ID: <span className="font-mono">{data._id || submissionId || "latest"}</span>
                    </p>
                </div>
                {percent !== null && (
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <div className="text-sm text-gray-500">Score (/20)</div>
                            <div className="text-4xl font-bold">{total?.toFixed(2)}</div>
                        </div>
                        <div className="w-28">
                            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                                <div
                                    className={`h-3 rounded-full ${percent >= 50 ? "bg-green-500" : "bg-red-500"}`}
                                    style={{ width: `${percent}%` }}
                                />
                            </div>
                            <div className="text-xs text-gray-500 mt-1 text-right">{percent}%</div>
                        </div>
                    </div>
                )}
            </div>

            {/* Feedback */}
            {feedback && (
                <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="text-sm text-gray-600">Feedback</div>
                    <div className="mt-1 text-gray-900">{feedback}</div>
                </div>
            )}

            {/* Details Table */}
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                    <div className="font-medium">Grading details</div>
                    <div className="text-sm text-gray-500">{details.length} items</div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead className="bg-gray-50">
                        <tr>
                            <th className="p-3 text-left">Question</th>
                            <th className="p-3 text-left">Type</th>
                            <th className="p-3 text-left">Expected</th>
                            <th className="p-3 text-left">Student</th>
                            <th className="p-3 text-right">Points</th>
                            <th className="p-3 text-right">Awarded</th>
                            <th className="p-3 text-left">Comment</th>
                        </tr>
                        </thead>
                        <tbody>
                        {details.map((d, idx) => {
                            const ok = d.awarded >= d.points - 1e-9;
                            return (
                                <tr key={idx} className="border-t">
                                    <td className="p-3 font-medium">{d.question_id || `#${d.index}`}</td>
                                    <td className="p-3 text-gray-600">{d.type}</td>
                                    <td className="p-3">
                                        <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{fmt(d.expected)}</code>
                                    </td>
                                    <td className="p-3">
                                        <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{fmt(d.student)}</code>
                                    </td>
                                    <td className="p-3 text-right">{round2(d.points)}</td>
                                    <td className="p-3 text-right">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${ok ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {round2(d.awarded)}
                      </span>
                                    </td>
                                    <td className="p-3 text-gray-600">{d.comment}</td>
                                </tr>
                            );
                        })}
                        </tbody>
                    </table>
                </div>

                <div className="px-4 py-3 border-t border-gray-200 flex items-center gap-3">
                    <button
                        onClick={() => window.print()}
                        className="px-3 py-2 rounded-xl bg-gray-900 text-white text-sm hover:opacity-90"
                    >
                        Print / Save PDF
                    </button>
                    <button
                        onClick={async () => {
                            try {
                                const id = data?._id || (submissionId !== "undefined" ? submissionId : null);
                                if (!id) return;
                                // regrade (route is non-API in your Flask)
                                await fetch(`${API_BASE}/submissions/${id}/regrade`);
                                // refetch updated submission
                                const res = await fetch(`${API_BASE}/api/submissions/${id}`);
                                if (res.ok) setData(await res.json());
                            } catch {}
                        }}
                        className="px-3 py-2 rounded-xl bg-blue-600 text-white text-sm hover:bg-blue-700"
                    >
                        Recalculate score
                    </button>
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
function round2(n) {
    if (n === null || n === undefined) return "0.00";
    return Number(n).toFixed(2);
}
