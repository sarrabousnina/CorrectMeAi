import React, { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./RouteStepper.css";

const STEPS = [
    { key: "upload",   label: "Upload",   path: "/" },
    { key: "key",      label: "Key",      path: "/key" },
    { key: "student",  label: "Students", path: "/student", clickable: true }, // only clickable
    { key: "correct",  label: "Correct",  path: "/correction" },
    { key: "result",   label: "Result",   path: "/result" },
];

function matchPath(current, stepPath) {
    const c = current.toLowerCase();
    const p = stepPath.toLowerCase();
    if (c === p) return true;
    if (p !== "/" && c.startsWith(p)) return true; // /result/:id
    return false;
}

export default function RouteStepper() {
    const { pathname } = useLocation();
    const navigate = useNavigate();

    const activeIndex = useMemo(() => {
        const idx = STEPS.findIndex(s => matchPath(pathname, s.path));
        return idx >= 0 ? idx : 0;
    }, [pathname]);

    return (
        <div className="stepper-sticky">
            <nav className="stepper-wrap" aria-label="Workflow steps">
                <ul className="stepper__list" data-active-index={activeIndex}>
                    {STEPS.map((s, i) => {
                        const isDone = i < activeIndex;
                        const isActive = i === activeIndex;

                        return (
                            <React.Fragment key={s.key}>
                                <li
                                    className={[
                                        "stepper__item",
                                        s.clickable ? "is-clickable" : "",
                                        isDone ? "is-done" : "",
                                        isActive ? "is-active" : "",
                                    ].join(" ")}
                                >
                                    {/* INLINE: replace number with pill when active */}
                                    {isActive ? (
                                        <div className="stepper__pill">
                                            {s.label}
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            className="stepper__dot"
                                            onClick={() => s.clickable && navigate(s.path)}
                                            disabled={!s.clickable}
                                            title={s.label}
                                        >
                                            <span className="stepper__num">{i + 1}</span>
                                        </button>
                                    )}
                                </li>

                                {/* connector */}
                                {i < STEPS.length - 1 && (
                                    <li
                                        aria-hidden="true"
                                        className={[
                                            "stepper__connector",
                                            i < activeIndex ? "is-done" : "",
                                        ].join(" ")}
                                    />
                                )}
                            </React.Fragment>
                        );
                    })}
                </ul>
            </nav>
        </div>
    );
}
