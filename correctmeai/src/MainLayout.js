import React, { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Components/SideBar/SideBar";
import "./Components/SideBar/SideBar.css";

/**
 * Desktop:
 *  - collapsed: mini (72px) with icons only
 * Mobile (<900px):
 *  - mobileOpen: slide-in over content with a backdrop
 */
export default function MainLayout() {
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    // close slide-in on window resize up to desktop
    useEffect(() => {
        const onResize = () => {
            if (window.innerWidth >= 900) setMobileOpen(false);
        };
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    return (
        <div
            className="layout"
            style={{
                // this CSS var lets the content shift automatically
                "--sb-current": collapsed ? "72px" : "240px",
            }}
        >
            <Sidebar
                collapsed={collapsed}
                mobileOpen={mobileOpen}
                onToggleCollapse={() => setCollapsed(v => !v)}
                onCloseMobile={() => setMobileOpen(false)}
            />

            {/* launcher button (mobile & mini modes) */}
{/*            {!mobileOpen && (
                <button
                    className="sb__launcher"
                    aria-label="Open menu"
                    onClick={() =>
                        window.innerWidth < 900 ? setMobileOpen(true) : setCollapsed(v => !v)
                    }
                >
                    ☰
                </button>
            )}*/}

            {/* dark backdrop when the sidebar is open on mobile */}
            {mobileOpen && <div className="sb__backdrop" onClick={() => setMobileOpen(false)} />}

            <main className="layout__main">
                <div className="layout__content">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
