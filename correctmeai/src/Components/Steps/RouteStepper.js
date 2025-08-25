// Enhanced RouteStepper.jsx
import React, { useMemo, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./RouteStepper.css";

const STEPS = [
    { key: "upload", label: "Upload", path: "/", icon: "📁" },
    { key: "key", label: "Key", path: "/key", icon: "🔑" },
    { key: "student", label: "Students", path: "/student", clickable: true, icon: "👥" },
    { key: "correct", label: "Correct", path: "/correction", icon: "✏️" },
    { key: "result", label: "Result", path: "/result", icon: "📊" },
    { key: "grades", label: "Grades", path: "/grades", icon: "🎓" },
];

function matchPath(current, stepPath) {
    const c = current.toLowerCase();
    const p = stepPath.toLowerCase();
    if (c === p) return true;
    if (p !== "/" && c.startsWith(p)) return true;
    return false;
}

export default function RouteStepper() {
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const [isVisible, setIsVisible] = useState(true);

    const activeIndex = useMemo(() => {
        const idx = STEPS.findIndex(s => matchPath(pathname, s.path));
        return idx >= 0 ? idx : 0;
    }, [pathname]);

    const progressPercentage = useMemo(() => {
        return ((activeIndex + 1) / STEPS.length) * 100;
    }, [activeIndex]);

    // Optional: Hide stepper on scroll (uncomment if desired)
    // useEffect(() => {
    //   let lastScrollY = window.scrollY;
    //
    //   const updateScrollDirection = () => {
    //     const scrollY = window.scrollY;
    //     const direction = scrollY > lastScrollY ? "down" : "up";
    //     if (direction !== scrollDirection) {
    //       setScrollDirection(direction);
    //       setIsVisible(direction === "up" || scrollY < 10);
    //     }
    //     lastScrollY = scrollY > 0 ? scrollY : 0;
    //   };
    //
    //   window.addEventListener("scroll", updateScrollDirection);
    //   return () => window.removeEventListener("scroll", updateScrollDirection);
    // }, []);

    const handleStepClick = (step, index) => {
        if (step.clickable && index <= activeIndex + 1) {
            navigate(step.path);
        }
    };

    const handleKeyDown = (e, step, index) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleStepClick(step, index);
        }
    };

    return (
        <div className={`stepper-sticky ${isVisible ? '' : 'stepper-hidden'}`}>
            <div className="stepper-progress-bar">
                <div
                    className="stepper-progress-fill"
                    style={{ width: `${progressPercentage}%` }}
                />
            </div>

            <nav className="stepper-wrap" aria-label="Workflow steps">
                <ul className="stepper__list" data-active-index={activeIndex}>
                    {STEPS.map((step, index) => {
                        const isDone = index < activeIndex;
                        const isActive = index === activeIndex;
                        const isClickable = step.clickable || index <= activeIndex + 1;

                        return (
                            <React.Fragment key={step.key}>
                                <li
                                    className={[
                                        "stepper__item",
                                        isClickable ? "is-clickable" : "",
                                        isDone ? "is-done" : "",
                                        isActive ? "is-active" : "",
                                    ].join(" ")}
                                >
                                    {isActive ? (
                                        <div className="stepper__pill">
                                            <span className="stepper__pill-icon">{step.icon}</span>
                                            <span className="stepper__pill-label">{step.label}</span>
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            className="stepper__dot"
                                            onClick={() => handleStepClick(step, index)}
                                            onKeyDown={(e) => handleKeyDown(e, step, index)}
                                            disabled={!isClickable}
                                            title={`${step.label}${isClickable ? ' (clickable)' : ''}`}
                                            aria-label={`Step ${index + 1}: ${step.label}${isDone ? ' (completed)' : ''}${isActive ? ' (current)' : ''}`}
                                        >
                                            <span className="stepper__num">{index + 1}</span>
                                            <span className="stepper__icon" aria-hidden="true">{step.icon}</span>
                                        </button>
                                    )}
                                </li>

                                {index < STEPS.length - 1 && (
                                    <li
                                        aria-hidden="true"
                                        className={[
                                            "stepper__connector",
                                            index < activeIndex ? "is-done" : "",
                                        ].join(" ")}
                                    />
                                )}
                            </React.Fragment>
                        );
                    })}
                </ul>

            {/*    <div className="stepper__status" aria-live="polite">
                    Step {activeIndex + 1} of {STEPS.length}: {STEPS[activeIndex].label}
                </div>*/}
            </nav>
        </div>
    );
}
