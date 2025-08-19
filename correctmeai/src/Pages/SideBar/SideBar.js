import React, { useEffect } from "react";
import { NavLink } from "react-router-dom";
import "./SideBar.css";

export default function Sidebar({
                                    collapsed = false,
                                    mobileOpen = false,
                                    onToggleCollapse = () => {},
                                    onCloseMobile = () => {},
                                }) {
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
                >
                    {window.innerWidth < 900 ? "✕" : "☰"}
                </button>
                <div className="sb__brand">CorrectMe</div>
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
        </aside>
    );
}
