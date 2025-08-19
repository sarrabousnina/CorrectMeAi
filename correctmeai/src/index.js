import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";

const reactRoot = ReactDOM.createRoot(document.getElementById("root"));
reactRoot.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);

/* ---------- Background interactivity driver ---------- */
if (!window.__bgInit) {
    window.__bgInit = true;

    const rootEl = document.documentElement;
    let targetX = 50, targetY = 50;
    let currX = 50,   currY = 50;
    let targetDX = 0, targetDY = 0;
    let currDX = 0,   currDY = 0;

    function setTargets(clientX, clientY, rect) {
        const x = (clientX - rect.left) / rect.width;
        const y = (clientY - rect.top)  / rect.height;
        targetX = Math.max(0, Math.min(100, x * 100));
        targetY = Math.max(0, Math.min(100, y * 100));
        targetDX = (x - 0.5) * 2;
        targetDY = (y - 0.5) * 2;
    }

    window.addEventListener("mousemove", (e) =>
        setTargets(e.clientX, e.clientY, document.body.getBoundingClientRect())
    );
    window.addEventListener("touchmove", (e) => {
        const t = e.touches[0];
        if (t) setTargets(t.clientX, t.clientY, document.body.getBoundingClientRect());
    });

    let t = 0;
    (function animate() {
        t += 0.06; // fast oscillation

        const idleX = Math.sin(t) * 14; // ±14%
        const idleY = Math.cos(t * 0.9) * 14;

        const easeFollow = 0.55;   // very quick follow
        const easeParallax = 0.6;  // very quick parallax

        currX += ((targetX + idleX) - currX) * easeFollow;
        currY += ((targetY + idleY) - currY) * easeFollow;
        currDX += (targetDX - currDX) * easeParallax;
        currDY += (targetDY - currDY) * easeParallax;

        rootEl.style.setProperty("--mx", currX.toFixed(2));
        rootEl.style.setProperty("--my", currY.toFixed(2));
        rootEl.style.setProperty("--dx", currDX.toFixed(3));
        rootEl.style.setProperty("--dy", currDY.toFixed(3));

        requestAnimationFrame(animate);
    })();
}
