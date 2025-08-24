import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { AUTH_BASE, setAuth } from "../api";
import "./Signup.css";

export default function Signup() {
    const [name, setName] = useState("");
    const [role, setRole] = useState("student");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [err, setErr] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const nav = useNavigate();

    async function onSubmit(e) {
        e.preventDefault();
        setErr("");

        // quick client-side validation
        const trimmedEmail = email.trim().toLowerCase();
        const trimmedName = (name || "").trim();
        if (!trimmedEmail || !password) {
            setErr("Email and password are required.");
            return;
        }
        if (password.length < 8) {
            setErr("Password must be at least 8 characters.");
            return;
        }

        setSubmitting(true);
        try {
            // IMPORTANT: backend route is /api/auth/register (AUTH_BASE already includes /api)
            const r = await fetch(`${AUTH_BASE}/auth/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: trimmedName || trimmedEmail.split("@")[0],
                    role,
                    email: trimmedEmail,
                    password,
                }),
            });

            const j = await r.json().catch(() => ({}));

            if (!r.ok || !j.token) {
                // surface common server messages
                const msg =
                    j?.error ||
                    (r.status === 409
                        ? "Email already exists."
                        : r.status === 401
                            ? "Admin authentication required to register more users."
                            : r.status === 403
                                ? "Only admins can create new users."
                                : "Register failed");
                setErr(msg);
                return;
            }

            // success: store token and user, go home
            setAuth(j.token, j.user);
            nav("/", { replace: true });
        } catch (e) {
            setErr("Network error. Is the backend running?");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="signup-page">
            <div className="signup-card">
                <header className="signup-header">
                    <h1 className="signup-title">Create account</h1>
                    <p className="signup-subtitle">Join the workspace and start grading.</p>
                </header>

                <form className="signup-form" onSubmit={onSubmit}>
                    <div className="signup-field">
                        <label className="signup-label">Name</label>
                        <input
                            className="signup-input"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Jane Doe"
                        />
                    </div>

                    <div className="signup-field">
                        <label className="signup-label">Email</label>
                        <input
                            className="signup-input"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            type="email"
                            required
                        />
                    </div>

                    <div className="signup-row">
                        <div className="signup-field">
                            <label className="signup-label">Password</label>
                            <input
                                className="signup-input"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="At least 8 characters"
                                type="password"
                                required
                            />
                        </div>

                        <div className="signup-field">
                            <label className="signup-label">Role</label>
                            <select
                                className="signup-select"
                                value={role}
                                onChange={(e) => setRole(e.target.value)}
                            >
                                <option value="admin">Admin</option>
                                <option value="instructor">Instructor</option>
                                <option value="student">Student</option>
                            </select>
                        </div>
                    </div>

                    {err && <div className="signup-error">{err}</div>}

                    <div className="signup-actions">
                        <button
                            type="button"
                            className="signup-btn signup-btn--ghost"
                            onClick={() => nav("/login")}
                            disabled={submitting}
                        >
                            Back to login
                        </button>
                        <button
                            type="submit"
                            className="signup-btn signup-btn--primary"
                            disabled={submitting}
                        >
                            {submitting ? "Signing up…" : "Sign up"}
                        </button>
                    </div>
                </form>

                <footer className="signup-footer">
                    Already have an account?{" "}
                    <Link to="/login" className="signup-link">
                        Sign in
                    </Link>
                </footer>
            </div>
        </div>
    );
}
