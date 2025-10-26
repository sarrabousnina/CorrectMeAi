import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Components/SideBar/SideBar";
import "./Components/SideBar/SideBar.css";

import RouteStepper from "./Components/Steps/RouteStepper";
import "./Components/Steps/RouteStepper.css";
import ProfChat from "./Components/ProfChat/ProfChat";

export default function MainLayout() {
    const { pathname } = useLocation();

    const HIDE_STEPPER_ON = ["/dashboard", "/listexams"];

    const shouldHideStepper = HIDE_STEPPER_ON.some((p) =>
        pathname.toLowerCase().startsWith(p)
    );

    return (
        <>
            <Sidebar />
            <main className="layout__main">
                {!shouldHideStepper && <RouteStepper />}
                <div className="layout__content">
                    <Outlet />
                </div>
            </main>

            <ProfChat />
        </>
    );
}
