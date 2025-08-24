export const GRADER_BASE = "http://localhost:5005";
export const AUTH_BASE   = `${GRADER_BASE}/api`;   // <-- important

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
