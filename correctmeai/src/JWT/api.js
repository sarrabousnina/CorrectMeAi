const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:5006";
const CORRECTOR_BASE = process.env.REACT_APP_CORRECTOR_BASE || "http://localhost:5005";

export const GRADER_BASE = API_BASE;
export const AUTH_BASE = `${API_BASE}/api`;
export const SUB_API = `${CORRECTOR_BASE}/api`;

export function setAuth(token, user) {
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user || {}));
}

export function getAuth() {
  try {
    return {
      token: localStorage.getItem("token"),
      user: JSON.parse(localStorage.getItem("user") || "{}"),
    };
  } catch {
    return { token: null, user: {} };
  }
}

export async function authedFetch(url, options = {}) {
  const { token } = getAuth();
  const headers = {
    ...options.headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  return fetch(url, { ...options, headers });
}

export async function authedJson(url, options = {}) {
  try {
    const response = await authedFetch(url, options);
    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, data: { error: error.message } };
  }
}