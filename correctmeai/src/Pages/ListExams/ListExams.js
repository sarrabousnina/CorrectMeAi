import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./ListExams.css";
import { authedFetch } from "../../JWT/api";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:5006";
// Normalize to YYYY-MM-DD
const toISODateOnly = (v) => {
    if (!v) return null;
    const d = new Date(v);
    return isNaN(d) ? null : d.toISOString().slice(0, 10);
};

// Human-friendly relative label for recent items
const relativeOrDate = (v) => {
    if (!v) return { label: "—", title: "" };
    const d = new Date(v);
    if (isNaN(d)) return { label: "—", title: "" };

    // start-of-day (local) to avoid off-by-one around midnight
    const startOfDay = (dt) => {
        const x = new Date(dt);
        x.setHours(0, 0, 0, 0);
        return x.getTime();
    };
    const now = new Date();
    const diffDays = Math.floor((startOfDay(now) - startOfDay(d)) / 86400000); // 1000*60*60*24

    if (diffDays <= 0) return { label: "Today", title: d.toString() };
    if (diffDays === 1) return { label: "Yesterday", title: d.toString() };
    if (diffDays <= 7) return { label: `${diffDays} days ago`, title: d.toString() };

    return { label: toISODateOnly(d), title: d.toString() };
};

export default function ListExams() {
    const [exams, setExams] = useState([]);
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [sortBy, setSortBy] = useState("created"); // created | title | submissions
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");
    const nav = useNavigate();
    const firstLoad = useRef(true);

    // ---- Quick date range helpers ----
    const setQuickRange = (days) => {
        const now = new Date();
        const from = new Date();
        from.setDate(now.getDate() - days);
        setFromDate(from.toISOString().slice(0, 10));
        setToDate(now.toISOString().slice(0, 10));
    };
    const clearRange = () => {
        setFromDate("");
        setToDate("");
    };
    const isRange = (days) => {
        if (!fromDate || !toDate) return false;
        const nowISO = new Date().toISOString().slice(0, 10);
        const d = new Date();
        d.setDate(d.getDate() - days);
        const wantFrom = d.toISOString().slice(0, 10);
        return fromDate === wantFrom && toDate === nowISO;
    };

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                setLoading(true);
                setErr("");
                const r = await authedFetch(`${API_BASE}/api/exams`, {
                    headers: { Accept: "application/json" },
                });
                if (!r.ok) {
                    if (r.status === 401) throw new Error("Failed to load exams (401)");
                    throw new Error(`Failed to load exams (${r.status})`);
                }
                const raw = await r.json();
                const arr = Array.isArray(raw) ? raw : [];

                const normalized = arr.map((e) => {
                    const createdAt = e.created_at || e.createdAt || null;
                    const updatedAt = e.updated_at || e.updatedAt || createdAt || null;
                    return {
                        _id: e._id ?? e.id,
                        title: e.title ?? "Untitled exam",
                        description: e.description ?? "",
                        createdAt,
                        updatedAt,
                        createdAtISO: toISODateOnly(createdAt),
                        pagesCount: e.pagesCount ?? (Array.isArray(e.pages) ? e.pages.length : 0),
                        submissionsCount: e.submissionsCount ?? (e.stats?.submissions ?? 0),
                    };
                });

                if (alive) setExams(normalized);
            } catch (e) {
                if (alive) setErr(e.message || "Failed to load exams");
            } finally {
                if (alive) setLoading(false);
                firstLoad.current = false;
            }
        })();
        return () => {
            alive = false;
        };
    }, []);

    const filtered = useMemo(() => {
        let list = exams.slice();

        // date range on createdAt
        const from = fromDate ? new Date(fromDate + "T00:00:00") : null;
        const to = toDate ? new Date(toDate + "T23:59:59") : null;
        if (from || to) {
            list = list.filter((e) => {
                const d = e.createdAt ? new Date(e.createdAt) : null;
                if (!d || isNaN(d)) return false;
                if (from && d < from) return false;
                if (to && d > to) return false;
                return true;
            });
        }

        // sort (Recently created by default)
        list.sort((a, b) => {
            switch (sortBy) {
                case "title":
                    return a.title.localeCompare(b.title);
                case "submissions":
                    return (b.submissionsCount ?? 0) - (a.submissionsCount ?? 0);
                case "created":
                default:
                    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
            }
        });

        return list;
    }, [exams, fromDate, toDate, sortBy]);

    return (
        <div className="list-exams-container classy">
            <header className="list-exams-header">
                <h1>Your Exams</h1>

                {/* Compact toolbar */}
                <div className="toolbar">
                    <div className="tool">
                        <span className="tool-label">From</span>
                        <input
                            type="date"
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                            aria-label="Created from date"
                        />
                    </div>
                    <div className="tool">
                        <span className="tool-label">To</span>
                        <input
                            type="date"
                            value={toDate}
                            onChange={(e) => setToDate(e.target.value)}
                            aria-label="Created to date"
                        />
                    </div>
                    <div className="tool">
                        <span className="tool-label">Sort</span>
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            aria-label="Sort exams"
                        >
                            <option value="created">Recently created</option>
                            <option value="title">Title A → Z</option>
                            <option value="submissions">Most submissions</option>
                        </select>
                    </div>

                    <div className="tool grow" />
                    <Link className="btn btn-primary" to="/CreateExam">
                        + New exam
                    </Link>
                </div>
            </header>

            {err && <div className="alert error">{err}</div>}

            {loading ? (
                <div className="exams-grid">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="exam-card skeleton card-minimal">
                            <div className="sk-line w-60" />
                            <div className="sk-line w-40" />
                            <div className="sk-pill w-24" />
                        </div>
                    ))}
                </div>
            ) : filtered.length === 0 ? (
                <div className="empty-state">
                    <div className="emoji">📄</div>
                    <h2>No exams found</h2>
                    <p>Adjust the date range or create a new exam.</p>
                </div>
            ) : (
                <div className="exams-grid">
                    {filtered.map((e) => {
                        const rel = relativeOrDate(e.createdAt);
                        return (
                            <article
                                key={e._id}
                                className="exam-card card-minimal"
                                onClick={() => nav(`/exam/${e._id}/grades`)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(k) =>
                                    k.key === "Enter" ? nav(`/exam/${e._id}/grades`) : null
                                }
                                aria-label={`${e.title} card`}
                            >
                                {/* Header: title + relative/date chip */}
                                <div className="card-head">
                                    <h3 className="exam-title" title={e.title}>
                                        {e.title}
                                    </h3>
                                    <span className="date-chip" title={rel.title}>
                    {rel.label}
                  </span>
                                </div>

                                {/* Optional description one-line */}
                                {e.description && (
                                    <p className="exam-desc one-line" title={e.description}>
                                        {e.description}
                                    </p>
                                )}

                                {/* Chips row */}
                                <div className="chips">
                  <span className="chip">
                    {e.pagesCount ?? 0} page{(e.pagesCount ?? 0) === 1 ? "" : "s"}
                  </span>
                                    <span className="chip">
                    {e.submissionsCount ?? 0} submission
                                        {(e.submissionsCount ?? 0) === 1 ? "" : "s"}
                  </span>
                                </div>

                                {/* Footer: only Open (also whole card is clickable) */}
                                <div className="card-foot">
                                    <Link
                                        to={`/exam/${e._id}/grades`}
                                        className="btn btn-ghost"
                                        onClick={(ev) => ev.stopPropagation()}
                                    >
                                        Open
                                    </Link>
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
