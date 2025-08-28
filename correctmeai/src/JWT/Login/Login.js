import React, { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { AUTH_BASE, setAuth } from "../api";
import "./Login.css";

export default function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [err, setErr] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const nav = useNavigate();
    const loc = useLocation();
    const from = loc.state?.from?.pathname || "/";

    async function onSubmit(e) {
        e.preventDefault();
        setErr("");

        const trimmedEmail = email.trim().toLowerCase();
        if (!trimmedEmail || !password) {
            setErr("Email and password are required.");
            return;
        }

        setSubmitting(true);
        try {
            const r = await fetch(`${AUTH_BASE}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: trimmedEmail, password }),
            });
            const j = await r.json().catch(() => ({}));

            if (!r.ok || !j.token) {
                setErr(
                    j?.error ||
                    (r.status === 401 ? "Invalid email or password." : "Login failed")
                );
                return;
            }

            setAuth(j.token, j.user);
            nav(from, { replace: true });
        } catch {
            setErr("Network error. Is the auth server running?");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="login-page">
            {/* Top bar */}
            <div className="login-topbar">
                <button className="topbar-back" type="button" onClick={() => nav("/welcome")}>
                    ← Back to HomePage
                </button>
                <div className="topbar-logo" onClick={() => nav("/")}>
                    <img src="/logo.png" alt="CorrectMeAi Logo" />
                    <span className="topbar-brand-text">CorrectMeAi</span>
                </div>
            </div>

            <div className="login-card">
                <header className="login-header">
                    <h1 className="login-title">Sign in</h1>
                    <p className="login-subtitle">Welcome back !</p>
                </header>

                <form className="login-form" onSubmit={onSubmit}>
                    <div className="login-field">
                        <label className="login-label">Email</label>
                        <input
                            className="login-input"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            type="email"
                            required
                        />
                    </div>

                    <div className="login-field">
                        <label className="login-label">Password</label>
                        <input
                            className="login-input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            type="password"
                            required
                        />
                    </div>

                    {err && <div className="login-error">{err}</div>}

                    <div className="login-actions">
                        <button
                            type="submit"
                            className="login-btn login-btn--primary"
                            disabled={submitting}
                        >
                            {submitting ? "Signing in…" : "Login"}
                        </button>
                    </div>
                </form>

                <footer className="login-footer">
                    No account? <Link to="/signup" className="login-link">Create one</Link>
                </footer>
            </div>
        </div>
    );
}
