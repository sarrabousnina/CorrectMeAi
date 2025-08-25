import React, { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import "./SideBar.css";

export default function Sidebar() {
    const nav = useNavigate();

    // Sidebar state (self‑managed)
    const [collapsed, setCollapsed] = useState(true);   // default closed (desktop)
    const [mobileOpen, setMobileOpen] = useState(false); // default closed (mobile)

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

    // Click handler for the burger button
    const handleToggle = () => {
        if (window.innerWidth < 900) {
            setMobileOpen(false); // close on mobile
        } else {
            setCollapsed((c) => !c); // toggle on desktop
        }
    };

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
                    onClick={handleToggle}
                    aria-label="Toggle menu"
                    title={window.innerWidth < 900 ? "Close menu" : "Collapse/expand"}
                >
                    {window.innerWidth < 900 ? "✕" : "☰"}
                </button>

                <div className="sb__brand">CorrectMe</div>
                {/* (Theme toggle removed; now global in DarkLight) */}
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

            <div className="sb__bottom">
                <button className="sb__link sb__logout" onClick={handleLogout}>
                    <span className="sb__icon">🚪</span>
                    <span className="sb__label">Logout</span>
                </button>
            </div>
        </aside>
    );
}
