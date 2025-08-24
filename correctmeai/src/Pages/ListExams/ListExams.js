// src/Pages/ListExams/ListExams.js
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "./ListExams.css";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:5006";

export default function ListExams() {
    const [exams, setExams] = useState([]);
    const [q, setQ] = useState("");
    // filter: all | key | nokey
    const [status, setStatus] = useState("all");
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                setLoading(true);
                setErr("");
                const r = await fetch(`${API_BASE}/ListExams`, { headers: { Accept: "application/json" } });
                if (!r.ok) throw new Error(`Failed to load exams (${r.status})`);
                const raw = await r.json();
                const arr = Array.isArray(raw?.data) ? raw.data : Array.isArray(raw) ? raw : [];

                const normalized = arr.map((e) => {
                    // support either backend's hasKey or derive from answer_key if present
                    const hasKey =
                        typeof e.hasKey === "boolean"
                            ? e.hasKey
                            : Array.isArray(e.answer_key) && e.answer_key.length > 0;

                    return {
                        _id: e._id ?? e.id,
                        title: e.title ?? "Untitled exam",
                        description: e.description ?? "",
                        hasKey,
                        // keep status if backend sent it; otherwise derive
                        status: (e.status ?? (hasKey ? "published" : "draft")).toLowerCase(),
                        createdAt: e.created_at ?? e.createdAt ?? null,
                        updatedAt: e.updated_at ?? e.updatedAt ?? null,
                        pagesCount: e.pagesCount ?? (Array.isArray(e.pages) ? e.pages.length : 0),
                        submissionsCount: e.submissionsCount ?? (e.stats?.submissions ?? 0),
                        thumbnailUrl:
                            e.thumbnailUrl ??
                            e.thumbnail ??
                            (Array.isArray(e.pages) && e.pages[0]?.previewUrl) ??
                            undefined,
                    };
                });

                if (alive) setExams(normalized);
            } catch (e) {
                if (alive) setErr(e.message || "Failed to load exams");
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => {
            alive = false;
        };
    }, []);

    const filtered = useMemo(() => {
        let list = exams;

        // map filter -> hasKey
        if (status === "key") list = list.filter((e) => e.hasKey);
        if (status === "nokey") list = list.filter((e) => !e.hasKey);

        if (q.trim()) {
            const needle = q.toLowerCase();
            list = list.filter(
                (e) =>
                    e.title.toLowerCase().includes(needle) ||
                    (e.description ?? "").toLowerCase().includes(needle)
            );
        }
        return list;
    }, [exams, q, status]);

    return (
        <div className="list-exams-container">
            <div className="list-exams-header">
                <h1>All Exams</h1>
                <p>Temporary public list (no client filter yet)</p>
                <div className="list-exams-filters">
                    <input
                        type="search"
                        placeholder="Search exams…"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                    />
                    <select value={status} onChange={(e) => setStatus(e.target.value)}>
                        <option value="all">All statuses</option>
                        <option value="key">Key ready</option>
                        <option value="nokey">No key yet</option>
                    </select>
                </div>
            </div>

            {loading && <div>Loading…</div>}
            {err && <div style={{ color: "#a52828" }}>{err}</div>}

            {!loading && !err && filtered.length === 0 ? (
                <div className="exam-card" style={{ padding: "2rem", textAlign: "center" }}>
                    <h2 style={{ marginBottom: "0.5rem" }}>No exams found</h2>
                    <p>Add an exam to see it here.</p>
                </div>
            ) : (
                <div className="exams-grid">
                    {filtered.map((e) => (
                        <div key={e._id} className="exam-card">
                            <Link to={`/exam/${e._id}/grades`} className="exam-thumbnail">
                                {e.thumbnailUrl ? <img src={e.thumbnailUrl} alt={e.title} /> : "No preview"}
                            </Link>

                            <div className="exam-content">
                                <Link to={`/exam/${e._id}/grades`} className="exam-title">
                                    {e.title}
                                </Link>

                                {/* Badge text now reflects hasKey */}
                                <span className={`exam-status ${e.hasKey ? "published" : "draft"}`}>
                  {e.hasKey ? "Key ready" : "No key yet"}
                </span>

                                <p className="exam-meta">
                                    <span>{e.pagesCount ?? 0} Pages</span>
                                    <span>{e.submissionsCount ?? 0} Submissions</span>
                                </p>
                            </div>

                            <div className="exam-footer">
                                <Link to={`/exam/${e._id}/grades`}>Open</Link>
                                {/* ID hidden for professor view */}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
