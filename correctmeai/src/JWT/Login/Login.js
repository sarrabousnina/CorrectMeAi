import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { AUTH_BASE, setAuth } from "../api";
import "./Login.css";

const GOOGLE_CLIENT_ID =
    "726239267818-5db8k7sjccnur2oam8egk3k5r7carejj.apps.googleusercontent.com"; // public-safe

export default function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [err, setErr] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const nav = useNavigate();
    const loc = useLocation();
    const from = loc.state?.from?.pathname || "/";

    // Ref to mount Google's button
    const googleDivRef = useRef(null);

    useEffect(() => {
        // Render Google button when the script is available
        if (!window.google || !googleDivRef.current) return;

        window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: ({ credential }) => handleGoogleIdToken(credential),
            ux_mode: "popup",
        });

        // Clear previous button (React fast refresh, route changes, etc.)
        googleDivRef.current.innerHTML = "";

        window.google.accounts.id.renderButton(googleDivRef.current, {
            theme: "outline",
            size: "large",
            text: "signin_with",
            shape: "pill",
            logo_alignment: "left",
            width: 280,
        });

        // Optional: enable One Tap (comment out if you don’t want the prompt)
        // window.google.accounts.id.prompt();
    }, []);

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

    async function handleGoogleIdToken(idToken) {
        try {
            setErr("");
            const r = await fetch(`${AUTH_BASE}/auth/google`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ idToken }),
            });
            const j = await r.json().catch(() => ({}));
            if (!r.ok || !j.token) {
                throw new Error(j?.error || "Google login failed");
            }
            setAuth(j.token, j.user);
            nav(from, { replace: true });
        } catch (e) {
            setErr(e.message || "Google login failed");
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

                    <div className="login-actions" style={{ marginTop: 8 }}>
                        <button
                            type="submit"
                            className="login-btn login-btn--primary"
                            disabled={submitting}
                        >
                            {submitting ? "Signing in…" : "Login"}
                        </button>
                    </div>
                </form>

                {/* Divider */}
                <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    marginTop: 16,
                    marginBottom: 8
                }}>
                    <div style={{ height: 1, background: "var(--border)", flex: 1 }} />
                    <span style={{ color: "var(--muted)", fontSize: 13, fontWeight: 600 }}>or</span>
                    <div style={{ height: 1, background: "var(--border)", flex: 1 }} />
                </div>

                {/* Google Sign-In button mount point */}
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
                    <div ref={googleDivRef} />
                </div>

                <footer className="login-footer">
                    No account? <Link to="/signup" className="login-link">Create one</Link>
                </footer>
            </div>
        </div>
    );
}
