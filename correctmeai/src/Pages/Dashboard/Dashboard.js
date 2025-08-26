// src/Pages/Dashboard/Dashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
    ResponsiveContainer,
    LineChart,
    Line,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    RadialBarChart,
    RadialBar,
    Legend,
    AreaChart,
    Area,
} from "recharts";
import "./Dashboard.css";

/* ====== Config ====== */
const API_BASE =
    import.meta?.env?.VITE_API_BASE ||
    process.env.REACT_APP_API_BASE ||
    "http://localhost:5006";

const COLORS = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6"];

/* ---------- Small components ---------- */
function KpiCard({ label, value, delta, hint }) {
    const positive = (delta ?? 0) >= 0;
    return (
        <div className="dash-card kpi-card">
            <div className="kpi-label">{label}</div>
            <div className="kpi-value">{value ?? 0}</div>
            <div className={`kpi-delta ${positive ? "up" : "down"}`}>
                {positive ? `▲ ${Math.abs(delta ?? 0)}` : `▼ ${Math.abs(delta ?? 0)}`}
                <span className="kpi-hint"> • {hint}</span>
            </div>
        </div>
    );
}

export default function Dashboard() {
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState(null);

    // data for charts
    const [KPIS, setKPIS] = useState([]);
    const [CORRECTION, setCORRECTION] = useState([]);
    const [GRADE_DIST, setGRADE_DIST] = useState([]);
    const [SUBMISSIONS, setSUBMISSIONS] = useState([]);
    const [TIME_SAVED, setTIME_SAVED] = useState([]);
    const [TOP_STUDENTS, setTOP_STUDENTS] = useState([]);

    // Optional: pick an exam to filter dashboard: ?examId=...
    const examId = null; // put a string ObjectId if you want to filter

    useEffect(() => {
        let cancelled = false;

        async function load() {
            try {
                setLoading(true);
                setErr(null);

                const token = localStorage.getItem("token"); // or wherever you store it
                const qs = new URLSearchParams(examId ? { examId } : {});
                const res = await fetch(`${API_BASE}/api/dashboard/summary?${qs}`, {
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: token ? `Bearer ${token}` : "",
                    },
                    credentials: "include",
                });

                if (!res.ok) {
                    const t = await res.text();
                    throw new Error(t || `HTTP ${res.status}`);
                }

                const data = await res.json();
                if (cancelled) return;

                // KPIs
                const k = data.kpis || {};
                setKPIS([
                    { label: "Exams", value: k.exams ?? 0, delta: k.deltas?.exams ?? 0, hint: "this month" },
                    { label: "Submissions", value: k.submissions ?? 0, delta: k.deltas?.submissions ?? 0, hint: "this week" },
                    { label: "Corrected", value: k.corrected ?? 0, delta: k.deltas?.corrected ?? 0, hint: "done" },
                    { label: "Avg. Grade", value: k.avgGrade ?? 0, delta: k.deltas?.avgGrade ?? 0, hint: "trend (/20)" },
                ]);

                setCORRECTION(data.correctionStatus || []);
                setGRADE_DIST(data.gradeDistribution || []);
                setSUBMISSIONS(data.submissionsOverTime || []);
                setTIME_SAVED(data.timeSaved || []);
                setTOP_STUDENTS(data.topStudents || []);
            } catch (e) {
                if (!cancelled) setErr(e.message || "Failed to load dashboard");
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        load();
        return () => {
            cancelled = true;
        };
    }, [examId]);

    // derive corrected %
    const correctedPct = useMemo(() => {
        const corrected = CORRECTION.find((x) => x.name === "Corrected")?.value || 0;
        const pending = CORRECTION.find((x) => x.name === "Pending")?.value || 0;
        const total = corrected + pending;
        return total ? Math.round((corrected / total) * 100) : 0;
    }, [CORRECTION]);

    if (loading) {
        return (
            <div className="dashboard">
                <div className="container">
                    <div className="dash-card" style={{ padding: 16, textAlign: "center" }}>
                        Loading dashboard…
                    </div>
                </div>
            </div>
        );
    }

    if (err) {
        return (
            <div className="dashboard">
                <div className="container">
                    <div className="dash-card" style={{ padding: 16, color: "#b91c1c" }}>
                        Error: {err}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard">
            <div className="container">
                {/* KPI Row */}
                <div className="kpi-grid">
                    {KPIS.map((k) => (
                        <KpiCard key={k.label} {...k} />
                    ))}
                </div>

                {/* Charts */}
                <div className="grid">
                    {/* Correction status */}
                    <div className="dash-card">
                        <div className="dash-card__header">
                            <h3 className="dash-card__title">Correction Status</h3>
                            <p className="dash-card__subtitle">Corrected vs Pending</p>
                        </div>
                        <div className="split-2">
                            <div className="chart-box">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={CORRECTION}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={46}
                                            outerRadius={72}
                                            paddingAngle={3}
                                            dataKey="value"
                                        >
                                            {CORRECTION.map((_, i) => (
                                                <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(v) => [v, "Copies"]} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="chart-box">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RadialBarChart
                                        cx="50%"
                                        cy="50%"
                                        innerRadius="60%"
                                        outerRadius="100%"
                                        barSize={14}
                                        data={[{ name: "Completed", value: correctedPct }]}
                                    >
                                        <RadialBar
                                            minAngle={15}
                                            clockWise
                                            dataKey="value"
                                            cornerRadius={10}
                                            fill={COLORS[1]}
                                        />
                                        <Legend iconSize={10} layout="vertical" verticalAlign="middle" />
                                        <Tooltip formatter={(v) => [`${v}%`, "Completed"]} />
                                    </RadialBarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* Grade distribution */}
                    <div className="dash-card dash-card--wide">
                        <div className="dash-card__header">
                            <h3 className="dash-card__title">Grade Distribution</h3>
                            <p className="dash-card__subtitle">Bucketed by 4-point ranges</p>
                        </div>
                        <div className="chart-box tall">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={GRADE_DIST}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="bucket" />
                                    <YAxis />
                                    <Tooltip />
                                    <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                                        {GRADE_DIST.map((_, idx) => (
                                            <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Submissions over time */}
                    <div className="dash-card dash-card--wide">
                        <div className="dash-card__header">
                            <h3 className="dash-card__title">Submissions Over Time</h3>
                            <p className="dash-card__subtitle">Monitor weekly student activity</p>
                        </div>
                        <div className="chart-box tall">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={SUBMISSIONS}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="date" />
                                    <YAxis />
                                    <Tooltip />
                                    <Line type="monotone" dataKey="count" stroke={COLORS[0]} strokeWidth={3} dot={{ r: 3 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Time per copy */}
                    <div className="dash-card">
                        <div className="dash-card__header">
                            <h3 className="dash-card__title">Time per Copy</h3>
                            <p className="dash-card__subtitle">AI-assisted vs Manual (hours)</p>
                        </div>
                        <div className="chart-box tall">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={TIME_SAVED}>
                                    <defs>
                                        <linearGradient id="g-ai" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={COLORS[1]} stopOpacity={0.8} />
                                            <stop offset="95%" stopColor={COLORS[1]} stopOpacity={0.1} />
                                        </linearGradient>
                                        <linearGradient id="g-manual" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={COLORS[3]} stopOpacity={0.8} />
                                            <stop offset="95%" stopColor={COLORS[3]} stopOpacity={0.1} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="date" />
                                    <YAxis />
                                    <Tooltip />
                                    <Area type="monotone" dataKey="manual" stroke={COLORS[3]} fill="url(#g-manual)" strokeWidth={2} />
                                    <Area type="monotone" dataKey="ai" stroke={COLORS[1]} fill="url(#g-ai)" strokeWidth={2} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Top performers */}
                    <div className="dash-card">
                        <div className="dash-card__header">
                            <h3 className="dash-card__title">Top Performers</h3>
                            <p className="dash-card__subtitle">Best average grades</p>
                        </div>
                        <div className="chart-box tall">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={TOP_STUDENTS} layout="vertical" margin={{ left: 30 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis type="number" domain={[0, 20]} />
                                    <YAxis dataKey="name" type="category" />
                                    <Tooltip formatter={(v) => [v, "Grade /20"]} />
                                    <Bar dataKey="grade" radius={[0, 8, 8, 0]} fill={COLORS[4]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                <div className="footer-hint">
                    Data live from backend • add filters (class • subject • exam) when ready.
                </div>
            </div>
        </div>
    );
}
