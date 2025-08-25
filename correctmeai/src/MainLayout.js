import React from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Components/SideBar/SideBar";
import "./Components/SideBar/SideBar.css";

import RouteStepper from "./Components/Steps/RouteStepper";
import "./Components/Steps/RouteStepper.css";

export default function MainLayout() {
    return (
        <>
            <Sidebar />

            <main className="layout__main">
                {/* Sticky stepper lives inside the page (no fixed overlay) */}
                <RouteStepper />

                {/* Content */}
                <div className="layout__content">
                    <Outlet />
                </div>
            </main>
        </>
    );
}
