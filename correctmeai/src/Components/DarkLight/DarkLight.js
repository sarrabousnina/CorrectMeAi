import React, { useEffect, useState } from "react";
import "./DarkLight.css";

function getInitialTheme() {
    const saved = localStorage.getItem("theme");
    if (saved === "dark" || saved === "light") return saved;
    return window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
}

export default function DarkLight() {
    const [theme, setTheme] = useState(getInitialTheme);

    // Apply theme to <body> + persist
    useEffect(() => {
        const body = document.body;
        body.classList.remove("theme-dark", "theme-light");
        body.classList.add(theme === "dark" ? "theme-dark" : "theme-light");
        localStorage.setItem("theme", theme);
    }, [theme]);

    return (
        <button
            className="darklight-toggle"
            onClick={() => setTheme(t => (t === "dark" ? "light" : "dark"))}
            aria-label="Toggle dark mode"
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
      <span className="darklight-toggle__icon">
        {theme === "dark" ? "☀️" : "🌙"}
      </span>
        </button>
    );
}
