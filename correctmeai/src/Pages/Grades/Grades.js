// Grades.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "./Grades.css";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:5005";

export default function Grades() {
    const { examId: examIdFromRoute } = useParams();
    const navigate = useNavigate();

    const [exam, setExam] = useState(null);
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");
    const [q, setQ] = useState("");
    const [sort, setSort] = useState({ by: "score", dir: "desc" });

    useEffect(() => {
        let alive = true;

        async function run() {
            try {
                setLoading(true);
                setErr("");

                const url = examIdFromRoute
                    ? `${API_BASE}/api/exams/${encodeURIComponent(examIdFromRoute)}/submissions`
                    : `${API_BASE}/api/exams/latest/submissions`;

                const r = await fetch(url);
                if (!r.ok) throw new Error(`Failed to load (${r.status})`);

                const j = await r.json();
                const items = Array.isArray(j) ? j : (j.items || []);
                const ex = j.exam || null;

                const list = items.map(s => ({
                    id: s._id || s.id,
                    student: s.student_id || s.student || "—",
                    score: typeof s.score === "number" ? s.score : null,
                    percent: typeof s.score === "number" ? Math.round((s.score / 20) * 100) : null,
                    feedback: s.feedback || "",
                    updatedAt: s.updated_at || s.updatedAt || s.created_at || s.date || null,
                    raw: s,
                }));

                if (!alive) return;
                setExam(ex);
                setRows(list);
            } catch (e) {
                if (alive) setErr(e.message || "Error");
            } finally {
                if (alive) setLoading(false);
            }
        }

        run();
        return () => { alive = false; };
    }, [examIdFromRoute]);

    const filtered = useMemo(() => {
        const qq = q.trim().toLowerCase();
        let f = rows;
        if (qq) {
            f = f.filter(r =>
                String(r.student).toLowerCase().includes(qq) ||
                String(r.id).toLowerCase().includes(qq)
            );
        }
        const dir = sort.dir === "asc" ? 1 : -1;
        const by = sort.by;
        f = [...f].sort((a, b) => {
            if (by === "student") return String(a.student).localeCompare(String(b.student)) * dir;
            if (by === "date") return (new Date(a.updatedAt || 0) - new Date(b.updatedAt || 0)) * dir;
            return ((a.score ?? -1) - (b.score ?? -1)) * dir;
        });
        return f;
    }, [rows, q, sort]);

    const stats = useMemo(() => {
        const scores = rows.map(r => r.score).filter(n => typeof n === "number");
        if (!scores.length) return null;
        const sum = scores.reduce((a, b) => a + b, 0);
        const avg = sum / scores.length;
        return {
            count: scores.length,
            avg,
            best: Math.max(...scores),
            worst: Math.min(...scores),
            avgPct: Math.round((avg / 20) * 100),
        };
    }, [rows]);

    function badgeClass(p) {
        if (p == null) return "badge badge--neutral";
        if (p >= 85) return "badge badge--emerald";
        if (p >= 70) return "badge badge--green";
        if (p >= 50) return "badge badge--amber";
        return "badge badge--rose";
    }

    function toCSV() {
        const header = ["submission_id", "student_id", "score_/20", "percent", "updated_at", "feedback"];
        const lines = filtered.map(r => [
            r.id, r.student, (r.score ?? ""), (r.percent ?? ""), (r.updatedAt ?? ""),
            (r.feedback || "").replace(/\n/g, " ").replace(/"/g, '""')
        ]);
        const csv = [header, ...lines].map(row => row.map(c => `"${String(c ?? "")}"`).join(",")).join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${(exam?.title || "exam").replace(/\s+/g, "_")}_grades.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    async function regradeAll() {
        const ids = filtered.map(r => r.id).filter(Boolean);
        for (const id of ids) {
            try { await fetch(`${API_BASE}/submissions/${id}/regrade`); } catch {}
        }
    }

    return (
        <div className="page bg">
            <div className="container">
                <div className="card">
                    <div className="grades__header">
                        <div className="grades__left">
                            <h1 className="title">{exam?.title || "Exam Grades"}</h1>
                            <div className="meta">
                                {exam?.["_id"] && (
                                    <div>Exam ID: <span className="meta__mono">{exam._id}</span></div>
                                )}
                                {stats && (
                                    <div className="stats">
                                        <span>{stats.count} submissions</span>
                                        <span>Average <strong>{stats.avg.toFixed(2)}</strong> (/20)</span>
                                        <span className={`badge ${badgeClass(stats.avgPct).split(" ").pop()}`}>{stats.avgPct}% avg</span>
                                        <span>Best {stats.best.toFixed(2)}</span>
                                        <span>Worst {stats.worst.toFixed(2)}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="grades__right no-print" style={{gap: 8, display: "flex", alignItems: "center", flexWrap: "wrap"}}>
                            <input
                                className="input"
                                placeholder="Search by student or submission…"
                                value={q}
                                onChange={e => setQ(e.target.value)}
                            />
                            <div className="seg">
                                <button
                                    className={`seg__btn ${sort.by==="score" ? "is-active":""}`}
                                    onClick={() => setSort(s => ({ by: "score", dir: s.by==="score" && s.dir==="desc" ? "asc":"desc" }))}
                                >Score {sort.by==="score" ? (sort.dir==="desc" ? "↓":"↑") : ""}</button>
                                <button
                                    className={`seg__btn ${sort.by==="student" ? "is-active":""}`}
                                    onClick={() => setSort(s => ({ by: "student", dir: s.by==="student" && s.dir==="asc" ? "desc":"asc" }))}
                                >Student {sort.by==="student" ? (sort.dir==="asc" ? "↑":"↓") : ""}</button>
                                <button
                                    className={`seg__btn ${sort.by==="date" ? "is-active":""}`}
                                    onClick={() => setSort(s => ({ by: "date", dir: s.by==="date" && s.dir==="desc" ? "asc":"desc" }))}
                                >Date {sort.by==="date" ? (sort.dir==="desc" ? "↓":"↑") : ""}</button>
                            </div>
                            <button className="btn btn--ghost" onClick={() => window.print()}>Print</button>
                            <button className="btn btn--ghost" onClick={toCSV} disabled={!filtered.length}>Export CSV</button>
                            <button className="btn btn--primary" onClick={regradeAll} disabled={!filtered.length}>Regrade All</button>
                        </div>
                    </div>

                    {loading && <div className="pad text-muted">Loading…</div>}
                    {err && <div className="pad text-error">Error: {err}</div>}

                    {!loading && !err && (
                        <div className="table-wrap">
                            <table className="table grades">
                                <thead>
                                <tr>
                                    <th>Student</th>
                                    <th>Submission</th>
                                    <th className="right">Score (/20)</th>
                                    <th className="right">% </th>
                                    <th>Feedback</th>
                                    <th className="right">Updated</th>
                                </tr>
                                </thead>
                                <tbody>
                                {filtered.map(r => (
                                    <tr
                                        key={r.id}
                                        className="rowlink"
                                        onClick={() => navigate(`/result/${r.id}?student=${encodeURIComponent(r.student)}`)}
                                        title="Open detailed result"
                                    >
                                        <td className="strong">{r.student}</td>
                                        <td className="muted mono">{r.id}</td>
                                        <td className="right">{r.score != null ? r.score.toFixed(2) : "—"}</td>
                                        <td className="right">
                                            <span className={badgeClass(r.percent)}>{r.percent ?? "—"}%</span>
                                        </td>
                                        <td className="feedback-cell">{r.feedback || "—"}</td>
                                        <td className="right muted">{r.updatedAt ? new Date(r.updatedAt).toLocaleString() : "—"}</td>
                                    </tr>
                                ))}
                                {!filtered.length && (
                                    <tr><td colSpan={6} className="muted center pad">No submissions yet.</td></tr>
                                )}
                                </tbody>
                            </table>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
