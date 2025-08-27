// src/pages/HomePage/HomePage.js
import React, { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./HomePage.css";

/**
 * NOTE:
 * - Icons use Font Awesome classes (e.g., "fas fa-play").
 *   Add this in public/index.html <head>:
 *     <link rel="stylesheet"
 *       href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css"
 *       integrity="sha512-1ycn6IcaQQ40/MKBW2W4Rhis/DbILU74tGJ2a9YjQ6A4l+QfT0G8Jrjv0IYvG6W0P4SbJv0d3hZrj7l+8i1LwA=="
 *       crossorigin="anonymous" referrerpolicy="no-referrer" />
 * - Also include the Inter/Playfair fonts in public/index.html if you want them.
 */

export default function HomePage() {
    const navigate = useNavigate(); // optional if you want to programmatically redirect

    useEffect(() => {
        // Loading Screen
        const loading = document.getElementById("loading");
        const onWindowLoad = () => {
            setTimeout(() => loading?.classList.add("hidden"), 1000);
        };
        if (document.readyState === "complete") onWindowLoad();
        else window.addEventListener("load", onWindowLoad);

        // Header Background on Scroll (navy)
        const onScrollHeader = () => {
            const header = document.querySelector("header");
            if (!header) return;
            if (window.scrollY > 100) header.classList.add("scrolled");
            else header.classList.remove("scrolled");
        };
        window.addEventListener("scroll", onScrollHeader, { passive: true });

        // Intersection Observer (animate-on-scroll -> .animated)
        const observerOptions = { threshold: 0.1, rootMargin: "0px 0px -50px 0px" };
        const io = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) entry.target.classList.add("animated");
            });
        }, observerOptions);
        document.querySelectorAll(".animate-on-scroll").forEach((el) => io.observe(el));

        // Smooth scrolling ONLY for hash anchors inside this page
        const anchors = Array.from(document.querySelectorAll('a[href^="#"]'));
        const onAnchorClick = (e) => {
            e.preventDefault();
            const target = document.querySelector(e.currentTarget.getAttribute("href"));
            if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
        };
        anchors.forEach((a) => a.addEventListener("click", onAnchorClick));

        // Stats counters when stats section enters view
        const animateCounter = (element, target, duration = 2000) => {
            let start = 0;
            const increment = target / (duration / 16);
            const timer = setInterval(() => {
                start += increment;
                if (start >= target) {
                    element.textContent =
                        target + (target === 95 || target === 90 || target === 98 ? "%" : "+");
                    clearInterval(timer);
                } else {
                    element.textContent =
                        Math.floor(start) + (target === 95 || target === 90 || target === 98 ? "%" : "+");
                }
            }, 16);
        };

        const statsEl = document.querySelector(".stats");
        const statsObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                const nums = document.querySelectorAll(".stat-number");
                const targets = [95, 90, 50, 98];
                nums.forEach((stat, i) => setTimeout(() => animateCounter(stat, targets[i]), i * 200));
                statsObserver.unobserve(entry.target);
            });
        });
        if (statsEl) statsObserver.observe(statsEl);

        // Classy reveal on scroll
        const revealObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach((e) => {
                    if (e.isIntersecting) {
                        e.target.classList.add("shown");
                        revealObserver.unobserve(e.target);
                    }
                });
            },
            { threshold: 0.15 }
        );
        document
            .querySelectorAll(".feature-card, .pricing-card, .stat-item, .demo-text, .demo-video")
            .forEach((el) => {
                el.classList.add("reveal");
                revealObserver.observe(el);
            });

        // Subtle parallax for hero
        const hero = document.querySelector(".hero");
        const onScrollParallax = () => {
            if (!hero) return;
            const y = window.scrollY * 0.15;
            hero.style.backgroundPosition = `center ${-y}px`;
        };
        window.addEventListener("scroll", onScrollParallax, { passive: true });

        // Cleanup
        return () => {
            window.removeEventListener("load", onWindowLoad);
            window.removeEventListener("scroll", onScrollHeader);
            window.removeEventListener("scroll", onScrollParallax);
            anchors.forEach((a) => a.removeEventListener("click", onAnchorClick));
            io.disconnect();
            statsObserver.disconnect();
            revealObserver.disconnect();
        };
    }, []);

    return (
        <div className="homepage">
            {/* Loading Screen */}
            <div className="loading" id="loading">
                <div className="spinner" />
            </div>

            {/* Header */}
            <header>
                <nav>
                 <div className="logo">
                     <img src="/logo.png" alt="CorrectMeAi Logo" className="nav-logo"/>
                     <span className="logo-text">CorrectMeAi</span>
                    </div>

                    <ul className="nav-links">
                        <li><a href="#features">Features</a></li>
                        <li><a href="#pricing">Pricing</a></li>
                        <li><a href="#contact">Contact</a></li>

                        {/* Sign in / Sign up now use React Router */}
                        <li>
                            <Link to="/login" className="cta-nav">Sign in</Link>
                        </li>
                        <li>
                            <Link to="/signup" className="cta-nav">Sign up</Link>
                        </li>
                    </ul>
                </nav>
            </header>

            {/* Hero */}
            <section className="hero">
                <div className="hero-content">
                    <div className="hero-text">
                        <h1>
                            Correct Exams <span>Faster</span> with AI
                        </h1>
                        <p>
                            Upload scans or photos of student exams and let CorrectMeAi perform OCR, extract
                            answers, and grade against your rubric. Get instant, explainable feedback and
                            per-question analytics.
                        </p>
                    </div>
                </div>
            </section>

            {/* Stats */}
            <section className="stats" id="stats">
                <div className="stats-grid">
                    <div className="stat-item animate-on-scroll">
                        <span className="stat-number">95%</span>
                        <div className="stat-label">OCR Accuracy</div>
                    </div>
                    <div className="stat-item animate-on-scroll">
                        <span className="stat-number">90%</span>
                        <div className="stat-label">Manual Work Reduced</div>
                    </div>
                    <div className="stat-item animate-on-scroll">
                        <span className="stat-number">50K+</span>
                        <div className="stat-label">Exams Processed</div>
                    </div>
                    <div className="stat-item animate-on-scroll">
                        <span className="stat-number">98%</span>
                        <div className="stat-label">User Satisfaction</div>
                    </div>
                </div>
            </section>

            {/* Features */}
            <section className="features" id="features">
                <div className="section-header">
                    <h2 className="section-title">Why Teachers Choose CorrectMeAi</h2>
                    <p className="section-subtitle">
                        Built for real classrooms: robust OCR for handwriting, MCQs and blanks, rubric-based
                        scoring, and dashboards your professors actually use.
                    </p>
                </div>

                <div className="features-grid">
                    <div className="feature-card animate-on-scroll">
                        <div className="feature-icon"><i className="fas fa-rocket" /></div>
                        <h3>Handwriting OCR</h3>
                        <p>Extract answers from scanned or photographed sheets using a production-ready OCR pipeline tuned for mixed handwriting and print.</p>
                    </div>

                    <div className="feature-card animate-on-scroll">
                        <div className="feature-icon"><i className="fas fa-brain" /></div>
                        <h3>Rubric-based Grading</h3>
                        <p>Create rubrics per exam. CorrectMeAi aligns extracted answers to expected solutions with similarity checks and partial credit.</p>
                    </div>

                    <div className="feature-card animate-on-scroll">
                        <div className="feature-icon"><i className="fas fa-chart-line" /></div>
                        <h3>Per-question Analytics</h3>
                        <p>Spot weak topics instantly. Drill down by question, class, or time window—export to CSV for further analysis.</p>
                    </div>

                    <div className="feature-card animate-on-scroll">
                        <div className="feature-icon"><i className="fas fa-shield-alt" /></div>
                        <h3>Privacy & Security</h3>
                        <p>Role-based access, encrypted storage, and audit logs. Compatible with institutional policies and GDPR.</p>
                    </div>

                    <div className="feature-card animate-on-scroll">
                        <div className="feature-icon"><i className="fas fa-users" /></div>
                        <h3>Multi-format Questions</h3>
                        <p>Supports MCQs, fill-in-the-blank, numeric answers, and “circle the correct option” formats, with flexible scoring rules.</p>
                    </div>

                    <div className="feature-card animate-on-scroll">
                        <div className="feature-icon"><i className="fas fa-mobile-alt" /></div>
                        <h3>Live Streaming Feedback</h3>
                        <p>Watch grading stream as it happens—useful during exam import, OCR extraction, and LLM-based checks.</p>
                    </div>
                </div>
            </section>

            {/* Demo */}
            <section className="demo" id="demo">
                <div className="demo-content">
                    <div className="demo-text">
                        <h2>See CorrectMeAi in Action</h2>
                        <p>
                            See how a mixed-format exam (MCQ + blanks + numeric) is scanned, parsed, and graded
                            with explainable feedback and itemized scoring.
                        </p>
                        <Link to="/login" className="btn-primary">
                            <i className="fas fa-play" /> Launch Interactive Demo
                        </Link>
                    </div>

                    <div className="demo-video">
                        <div className="play-button"><i className="fas fa-play" /></div>
                        <h3>Interactive Demo</h3>
                        <p>Click to see CorrectMeAi analyze a real student paper</p>
                    </div>
                </div>
            </section>

            {/* Pricing */}
            <section className="pricing" id="pricing">
                <div className="section-header">
                    <h2 className="section-title">Plans for Every Team</h2>
                    <p className="section-subtitle">From small classes to whole departments—start free and scale as you grow.</p>
                </div>

                <div className="pricing-grid">
                    <div className="pricing-card animate-on-scroll">
                        <h3 className="plan-name">Starter (Classroom)</h3>
                        <div className="price">$29<span>/month</span></div>
                        <ul className="plan-features">
                            <li>Up to 200 exams/month</li>
                            <li>OCR + MCQ + blanks</li>
                            <li>Community support</li>
                            <li>Basic rubric templates</li>
                            <li>Per-question stats</li>
                        </ul>
                        <Link to="/signup" className="btn-pricing">Open Web App</Link>
                    </div>

                    <div className="pricing-card featured animate-on-scroll">
                        <h3 className="plan-name">Pro (Department)</h3>
                        <div className="price">$79<span>/month</span></div>
                        <ul className="plan-features">
                            <li>Up to 1,000 exams/month</li>
                            <li>Handwriting tuning + numeric parsing</li>
                            <li>Advanced rubric rules (partial credit, ranges)</li>
                            <li>Priority support</li>
                            <li>Export & dashboards</li>
                            <li>Custom rubrics</li>
                            <li>Team roles & reviews</li>
                        </ul>
                        <Link to="/signup" className="btn-pricing">Choose Pro</Link>
                    </div>

                    <div className="pricing-card animate-on-scroll">
                        <h3 className="plan-name">Campus</h3>
                        <div className="price">$199<span>/month</span></div>
                        <ul className="plan-features">
                            <li>Unlimited exams</li>
                            <li>On-prem / private cloud options</li>
                            <li>Full API access</li>
                            <li>Dedicated success engineer</li>
                            <li>Advanced analytics + SSO</li>
                            <li>White-label portal</li>
                            <li>SLA & security reviews</li>
                        </ul>
                        <Link to="/signup" className="btn-pricing">Talk to Sales</Link>
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="cta-section">
                <div className="cta-content">
                    <h2 className="cta-title">Ready to Automate Exam Correction?</h2>
                    <p className="cta-subtitle">
                        Join thousands of educators who are already saving time and improving student outcomes
                        with CorrectMeAi.
                    </p>
                    <Link to="/login" className="btn-cta">Open the Web App</Link>
                </div>
            </section>

            {/* Footer */}
            <footer id="contact">
                <div className="footer-content">
                    <div className="footer-section">
                        <h3>CorrectMeAi</h3>
                        <p>AI-powered exam correction with OCR, rubric scoring, and analytics—built for real classrooms.</p>
                    </div>
                    <div className="footer-section">
                        <h3>Product</h3>
                        <p><a href="#features">Features</a></p>
                        <p><a href="#pricing">Pricing</a></p>
                        <p><Link to="/login">Live Demo</Link></p>
                        <p><a href="#api">API</a></p>
                    </div>
                    <div className="footer-section">
                        <h3>Support</h3>
                        <p><a href="#help">Help Center</a></p>
                        <p><a href="#docs">Documentation</a></p>
                        <p><a href="#contact">Contact Us</a></p>
                        <p><a href="#status">System Status</a></p>
                    </div>
                    <div className="footer-section">
                        <h3>Company</h3>
                        <p><a href="#about">About Us</a></p>
                        <p><a href="#blog">Blog</a></p>
                        <p><a href="#careers">Careers</a></p>
                        <p><a href="#press">Press</a></p>
                    </div>
                    <div className="footer-section">
                        <h3>Legal</h3>
                        <p><a href="#privacy">Privacy Policy</a></p>
                        <p><a href="#terms">Terms of Service</a></p>
                        <p><a href="#security">Security</a></p>
                        <p><a href="#gdpr">GDPR</a></p>
                    </div>
                </div>
                <div className="footer-bottom">
                    <p>&copy; 2024 CorrectMeAi. All rights reserved. | Made with ❤️ for educators worldwide</p>
                </div>
            </footer>
        </div>
    );
}
