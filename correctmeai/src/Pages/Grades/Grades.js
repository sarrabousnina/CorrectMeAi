// src/Pages/Grades/Grades.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "./Grades.css";
import { SUB_API, authedFetch } from "../../JWT/api";

export default function Grades() {
  const { examId: examIdFromRoute } = useParams();
  const navigate = useNavigate();

  const [exam, setExam] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState({ by: "score", dir: "desc" });

  useEffect(() => {
    let isMounted = true;

    const loadSubmissions = async () => {
      try {
        setLoading(true);
        setError("");

        const url = examIdFromRoute
          ? `${SUB_API}/exams/${encodeURIComponent(examIdFromRoute)}/submissions`
          : `${SUB_API}/exams/latest/submissions`;

        const response = await authedFetch(url);
        if (!response.ok) throw new Error(`Failed to load (${response.status})`);

        const data = await response.json();
        const items = Array.isArray(data) ? data : data.items || [];
        const examInfo = data.exam || null;

        const submissions = items.map((sub) => ({
          id: sub._id || sub.id,
          student: sub.student_id || sub.student || "—",
          score: typeof sub.score === "number" ? sub.score : null,
          percent: typeof sub.score === "number" ? Math.round((sub.score / 20) * 100) : null,
          feedback: sub.feedback || "",
          updatedAt: sub.updated_at || sub.updatedAt || sub.created_at || sub.date || null,
          raw: sub,
        }));

        if (!isMounted) return;
        setExam(examInfo);
        setRows(submissions);
      } catch (err) {
        if (isMounted) setError(err.message || "Error loading grades");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadSubmissions();
    return () => {
      isMounted = false;
    };
  }, [examIdFromRoute]);

  const filteredAndSorted = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let result = rows;

    if (query) {
      result = result.filter(
        (row) =>
          String(row.student).toLowerCase().includes(query) ||
          String(row.id).toLowerCase().includes(query)
      );
    }

    const { by, dir } = sortConfig;
    const direction = dir === "asc" ? 1 : -1;

    return [...result].sort((a, b) => {
      if (by === "student") {
        return String(a.student).localeCompare(String(b.student)) * direction;
      }
      if (by === "date") {
        return (new Date(a.updatedAt || 0) - new Date(b.updatedAt || 0)) * direction;
      }
      return ((a.score ?? -1) - (b.score ?? -1)) * direction;
    });
  }, [rows, searchQuery, sortConfig]);

  const stats = useMemo(() => {
    const validScores = rows
      .map((r) => r.score)
      .filter((score) => typeof score === "number");
    
    if (validScores.length === 0) return null;

    const sum = validScores.reduce((a, b) => a + b, 0);
    const avg = sum / validScores.length;

    return {
      count: validScores.length,
      avg,
      best: Math.max(...validScores),
      worst: Math.min(...validScores),
      avgPct: Math.round((avg / 20) * 100),
    };
  }, [rows]);

  const getBadgeClass = (percent) => {
    if (percent == null) return "badge badge--neutral";
    if (percent >= 85) return "badge badge--emerald";
    if (percent >= 70) return "badge badge--green";
    if (percent >= 50) return "badge badge--amber";
    return "badge badge--rose";
  };

  const exportToCSV = () => {
    const header = [
      "submission_id",
      "student_id",
      "score_/20",
      "percent",
      "updated_at",
      "feedback",
    ];
    const lines = filteredAndSorted.map((row) => [
      row.id,
      row.student,
      row.score ?? "",
      row.percent ?? "",
      row.updatedAt ?? "",
      (row.feedback || "").replace(/\n/g, " ").replace(/"/g, '""'),
    ]);
    const csvContent = [header, ...lines]
      .map((line) => line.map((cell) => `"${String(cell ?? "")}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(exam?.title || "exam").replace(/\s+/g, "_")}_grades.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const regradeAll = async () => {
    if (!window.confirm("Regrade all visible submissions? This may take a while.")) return;
    
    const ids = filteredAndSorted.map((r) => r.id).filter(Boolean);
    for (const id of ids) {
      try {
        await authedFetch(`${SUB_API}/submissions/${id}/regrade`, { method: "POST" });
      } catch (err) {
        console.warn(`Failed to regrade submission ${id}:`, err);
      }
    }
    // Optionally: refresh data after regrading
  };

  const toggleSort = (field) => {
    setSortConfig((prev) => {
      if (prev.by === field) {
        return { by: field, dir: prev.dir === "asc" ? "desc" : "asc" };
      }
      return { by: field, dir: "desc" };
    });
  };

  return (
    <div className="page">
      <div className="container">
        <div className="card card--fill">
          <div className="grades__header">
            <div className="grades__left">
              <h1 className="title">{exam?.title || "Exam Grades"}</h1>
              {stats && (
                <div className="stats">
                  <span>{stats.count} submissions</span>
                  <span>
                    Average <strong>{stats.avg.toFixed(2)}</strong> (/20)
                  </span>
                  <span className={`badge ${getBadgeClass(stats.avgPct).split(" ").pop()}`}>
                    {stats.avgPct}% avg
                  </span>
                  <span>Best {stats.best.toFixed(2)}</span>
                  <span>Worst {stats.worst.toFixed(2)}</span>
                </div>
              )}
            </div>

            <div className="grades__right no-print">
              <input
                className="input"
                placeholder="Search by student or submission…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <div className="seg">
                <button
                  className={`seg__btn ${sortConfig.by === "score" ? "is-active" : ""}`}
                  onClick={() => toggleSort("score")}
                >
                  Score {sortConfig.by === "score" ? (sortConfig.dir === "desc" ? "↓" : "↑") : ""}
                </button>
                <button
                  className={`seg__btn ${sortConfig.by === "student" ? "is-active" : ""}`}
                  onClick={() => toggleSort("student")}
                >
                  Student {sortConfig.by === "student" ? (sortConfig.dir === "asc" ? "↑" : "↓") : ""}
                </button>
                <button
                  className={`seg__btn ${sortConfig.by === "date" ? "is-active" : ""}`}
                  onClick={() => toggleSort("date")}
                >
                  Date {sortConfig.by === "date" ? (sortConfig.dir === "desc" ? "↓" : "↑") : ""}
                </button>
              </div>
              <button className="btn btn--ghost" onClick={() => window.print()}>
                Print
              </button>
              <button className="btn btn--ghost" onClick={exportToCSV} disabled={!filteredAndSorted.length}>
                Export CSV
              </button>
              <button className="btn btn--primary" onClick={regradeAll} disabled={!filteredAndSorted.length}>
                Regrade All
              </button>
            </div>
          </div>

          {loading && <div className="pad text-muted" style={{ padding: "1rem" }}>Loading…</div>}
          {error && <div className="pad text-error" style={{ padding: "1rem" }}>Error: {error}</div>}

          {!loading && !error && (
            <div className="table-wrap">
              <table className="table grades">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Submission</th>
                    <th className="right">Score (/20)</th>
                    <th className="right">%</th>
                    <th>Feedback</th>
                    <th className="right">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSorted.map((row) => (
                    <tr
                      key={row.id}
                      className="rowlink"
                      onClick={() =>
                        navigate(`/result/${row.id}?student=${encodeURIComponent(row.student)}`)
                      }
                      title="Open detailed result"
                    >
                      <td className="strong">{row.student}</td>
                      <td className="muted mono">{row.id}</td>
                      <td className="right">{row.score != null ? row.score.toFixed(2) : "—"}</td>
                      <td className="right">
                        <span className={getBadgeClass(row.percent)}>{row.percent ?? "—"}%</span>
                      </td>
                      <td className="feedback-cell">{row.feedback || "—"}</td>
                      <td className="right muted">
                        {row.updatedAt ? new Date(row.updatedAt).toLocaleString() : "—"}
                      </td>
                    </tr>
                  ))}
                  {filteredAndSorted.length === 0 && (
                    <tr>
                      <td colSpan={6} className="muted center pad" style={{ padding: "1rem" }}>
                        No submissions yet.
                      </td>
                    </tr>
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