import React, { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import "./SideBar.css";

export default function Sidebar({
                                    collapsed = false,
                                    mobileOpen = false,
                                    onToggleCollapse = () => {},
                                    onCloseMobile = () => {},
                                }) {
    const nav = useNavigate();

    // ---- THEME: read, initialize, and persist
    const getInitialTheme = () => {
        const saved = localStorage.getItem("theme");
        if (saved === "dark" || saved === "light") return saved;
        return window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light";
    };

    const [theme, setTheme] = useState(getInitialTheme);

    useEffect(() => {
        const body = document.body;
        body.classList.remove("theme-dark", "theme-light");
        body.classList.add(theme === "dark" ? "theme-dark" : "theme-light");
        localStorage.setItem("theme", theme);
    }, [theme]);

    // Keep page content shifted with the sidebar (desktop & mobile)
    useEffect(() => {
        const body = document.body;

        const apply = () => {
            const isMobile = window.innerWidth < 900;

            body.classList.remove(
                "sb-expanded",
                "sb-collapsed",
                "sb-mobile-open",
                "sb-mobile-closed"
            );

            if (isMobile) {
                body.classList.add(mobileOpen ? "sb-mobile-open" : "sb-mobile-closed");
            } else {
                body.classList.add(collapsed ? "sb-collapsed" : "sb-expanded");
            }
        };

        apply();
        window.addEventListener("resize", apply);
        return () => window.removeEventListener("resize", apply);
    }, [collapsed, mobileOpen]);

    // ---- LOGOUT HANDLER ----
    function handleLogout() {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        nav("/login", { replace: true });
    }

    return (
        <aside
            className={[
                "sb",
                collapsed ? "sb--collapsed" : "",
                mobileOpen ? "sb--open" : "",
            ].join(" ")}
        >
            <div className="sb__top">
                <button
                    className="sb__burger"
                    onClick={() =>
                        window.innerWidth < 900 ? onCloseMobile() : onToggleCollapse()
                    }
                    aria-label="Toggle menu"
                    title={window.innerWidth < 900 ? "Close menu" : "Collapse/expand"}
                >
                    {window.innerWidth < 900 ? "✕" : "☰"}
                </button>

                <div className="sb__brand">CorrectMe</div>

                {/* DARK MODE TOGGLE */}
                <button
                    className="sb__theme"
                    onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
                    aria-label="Toggle dark mode"
                    title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                >
                    <span className="sb__themeIcon" aria-hidden="true">
                        {theme === "dark" ? "☀️" : "🌙"}
                    </span>
                </button>
            </div>

            <nav className="sb__nav">
                <NavLink end to="/" className="sb__link">
                    <span className="sb__icon">🏠</span>
                    <span className="sb__label">Home</span>
                </NavLink>

                <NavLink to="/ListExams" className="sb__link">
                    <span className="sb__icon">📚</span>
                    <span className="sb__label">List Exams</span>
                </NavLink>

                <NavLink to="/grades" className="sb__link">
                    <span className="sb__icon">🎓</span>
                    <span className="sb__label">Grades</span>
                </NavLink>
            </nav>

            {/* LOGOUT BUTTON AT THE BOTTOM */}
            <div className="sb__bottom">
                <button className="sb__link sb__logout" onClick={handleLogout}>
                    <span className="sb__icon">🚪</span>
                    <span className="sb__label">Logout</span>
                </button>
            </div>
        </aside>
    );
}
