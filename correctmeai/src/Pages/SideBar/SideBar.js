import React from "react";
import { NavLink } from "react-router-dom";
import "./SideBar.css";

export default function Sidebar({
                                    collapsed = false,
                                    mobileOpen = false,
                                    onToggleCollapse = () => {},
                                    onCloseMobile = () => {},
                                }) {
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

                {/* REPLACE examId with a real one or navigate from exam cards */}
                <NavLink to="/grades" className="sb__link">
                    <span className="sb__icon">🎓</span>
                    <span className="sb__label">Grades</span>
                </NavLink>
            </nav>
        </aside>
    );
}
