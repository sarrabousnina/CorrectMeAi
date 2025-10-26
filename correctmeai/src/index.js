// src/index.js
import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";

// Render React app
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// -------------------------------
// Interactive background effect
// -------------------------------
if (!window.__bgInit) {
  window.__bgInit = true;

  const rootEl = document.documentElement;
  let targetX = 50, targetY = 50;
  let currX = 50, currY = 50;
  let targetDX = 0, targetDY = 0;
  let currDX = 0, currDY = 0;

  const setTargets = (clientX, clientY, rect) => {
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;
    targetX = Math.max(0, Math.min(100, x * 100));
    targetY = Math.max(0, Math.min(100, y * 100));
    targetDX = (x - 0.5) * 2;
    targetDY = (y - 0.5) * 2;
  };

  const handleMove = (e) => {
    setTargets(e.clientX, e.clientY, document.body.getBoundingClientRect());
  };

  const handleTouch = (e) => {
    if (e.touches[0]) {
      setTargets(e.touches[0].clientX, e.touches[0].clientY, document.body.getBoundingClientRect());
    }
  };

  window.addEventListener("mousemove", handleMove);
  window.addEventListener("touchmove", handleTouch, { passive: true });

  let t = 0;
  const animate = () => {
    t += 0.06;

    const idleX = Math.sin(t) * 14;
    const idleY = Math.cos(t * 0.9) * 14;

    const easeFollow = 0.55;
    const easeParallax = 0.6;

    currX += (targetX + idleX - currX) * easeFollow;
    currY += (targetY + idleY - currY) * easeFollow;
    currDX += (targetDX - currDX) * easeParallax;
    currDY += (targetDY - currDY) * easeParallax;

    rootEl.style.setProperty("--mx", currX.toFixed(2));
    rootEl.style.setProperty("--my", currY.toFixed(2));
    rootEl.style.setProperty("--dx", currDX.toFixed(3));
    rootEl.style.setProperty("--dy", currDY.toFixed(3));

    requestAnimationFrame(animate);
  };

  animate();
}