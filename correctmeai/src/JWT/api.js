// src/api.js (updated)

export const GRADER_BASE = process.env.REACT_APP_API_BASE || "http://localhost:5006"; // main backend (auth + exams)
export const AUTH_BASE   = `${GRADER_BASE}/api`;                                      // /api/auth/*, /api/exams, etc.

// grading/submissions live on the corrector server
export const CORRECTOR_BASE = process.env.REACT_APP_CORRECTOR_BASE || "http://localhost:5005";
export const SUB_API        = `${CORRECTOR_BASE}/api`;                                // /api/submissions/*, /api/exams/:id/submissions

export function setAuth(token, user) {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user || {}));
}

export function getAuth() {
    return {
        token: localStorage.getItem("token"),
        user: JSON.parse(localStorage.getItem("user") || "{}"),
    };
}

export async function authedFetch(url, opts = {}) {
    const { token } = getAuth();
    const headers = { ...(opts.headers || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(url, { ...opts, headers });
}

// (optional helpers)
export async function authedJson(url, opts = {}) {
    const r = await authedFetch(url, opts);
    const j = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, data: j };
}
