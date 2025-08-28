import React, { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import "./SideBar.css";

/* === ICON IMAGES (from src/Images) === */
import homeIcon from "../../Images/maison.png";
import examsIcon from "../../Images/examen.png";
import gradesIcon from "../../Images/notes-des-etudiants.png";
import dashboardIcon from "../../Images/lanalyse-des-donnees.png";
import generatorIcon from "../../Images/assistant-intelligent.png";
import logoutIcon from "../../Images/se-deconnecter.png";

export default function Sidebar() {
    const nav = useNavigate();

    /* ---------- THEME ---------- */
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

    /* ---------- SIDEBAR STATE ---------- */
    const [collapsed, setCollapsed] = useState(true); // default closed (desktop)
    const [mobileOpen, setMobileOpen] = useState(false); // default closed (mobile)

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

    /* ---------- ACTIONS ---------- */
    function handleLogout() {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        nav("/login", { replace: true });
    }

    const handleToggle = () => {
        if (window.innerWidth < 900) {
            setMobileOpen(false);
        } else {
            setCollapsed((c) => !c);
        }
    };

    const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

    /* ---------- RENDER ---------- */
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
            </div>

            <nav className="sb__nav">
                <NavLink end to="/" className="sb__link">
          <span className="sb__icon">
            <img
                src={homeIcon}
                alt="Home"
                className="sb__icon-img"
                width={22}
                height={22}
                loading="lazy"
            />
          </span>
                    <span className="sb__label">Home</span>
                </NavLink>

                <NavLink to="/ListExams" className="sb__link">
          <span className="sb__icon">
            <img
                src={examsIcon}
                alt="Exams"
                className="sb__icon-img"
                width={22}
                height={22}
                loading="lazy"
            />
          </span>
                    <span className="sb__label">List Exams</span>
                </NavLink>

                <NavLink to="/grades" className="sb__link">
          <span className="sb__icon">
            <img
                src={gradesIcon}
                alt="Grades"
                className="sb__icon-img"
                width={22}
                height={22}
                loading="lazy"
            />
          </span>
                    <span className="sb__label">Grades</span>
                </NavLink>

                <NavLink to="/dashboard" className="sb__link">
          <span className="sb__icon">
            <img
                src={dashboardIcon}
                alt="Dashboard"
                className="sb__icon-img"
                width={22}
                height={22}
                loading="lazy"
            />
          </span>
                    <span className="sb__label">Dashboard</span>
                </NavLink>

            </nav>

            {/* FOOTER: Theme + Logout */}
            <div className="sb__bottom">
                <button
                    className="sb__link sb__themeLink"
                    onClick={toggleTheme}
                    aria-label="Toggle dark/light"
                    title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                >
          <span className="sb__icon" aria-hidden="true">
            {theme === "dark" ? "☀️" : "🌙"}
          </span>
                    <span className="sb__label">
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </span>
                </button>

                <button className="sb__link sb__logout" onClick={handleLogout}>
          <span className="sb__icon">
            <img
                src={logoutIcon}
                alt="Logout"
                className="sb__icon-img"
                width={22}
                height={22}
                loading="lazy"
            />
          </span>
                    <span className="sb__label">Logout</span>
                </button>
            </div>
        </aside>
    );
}
