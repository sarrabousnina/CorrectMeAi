// src/Pages/HomePage/HomePage.jsx
import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import "./HomePage.css";

export default function HomePage() {
  useEffect(() => {
    const loading = document.getElementById("loading");
    const onWindowLoad = () => {
      setTimeout(() => loading?.classList.add("hidden"), 1000);
    };

    if (document.readyState === "complete") {
      onWindowLoad();
    } else {
      window.addEventListener("load", onWindowLoad);
    }

    // Header scroll effect
    const onScrollHeader = () => {
      const header = document.querySelector("header");
      if (header) {
        header.classList.toggle("scrolled", window.scrollY > 100);
      }
    };
    window.addEventListener("scroll", onScrollHeader, { passive: true });

    // Animate on scroll
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("animated");
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -50px 0px" }
    );
    document.querySelectorAll(".animate-on-scroll").forEach((el) => observer.observe(el));

    // Smooth scroll for hash links
    const handleAnchorClick = (e) => {
      e.preventDefault();
      const target = document.querySelector(e.currentTarget.getAttribute("href"));
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };
    const anchors = Array.from(document.querySelectorAll('a[href^="#"]'));
    anchors.forEach((a) => a.addEventListener("click", handleAnchorClick));

    // Stats counter animation
    const animateCounter = (element, target, duration = 2000) => {
      let start = 0;
      const increment = target / (duration / 16);
      const timer = setInterval(() => {
        start += increment;
        const suffix = [95, 90, 98].includes(target) ? "%" : "+";
        if (start >= target) {
          element.textContent = `${target}${suffix}`;
          clearInterval(timer);
        } else {
          element.textContent = `${Math.floor(start)}${suffix}`;
        }
      }, 16);
    };

    const statsEl = document.querySelector(".stats");
    if (statsEl) {
      const statsObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const numbers = document.querySelectorAll(".stat-number");
            const targets = [95, 90, 50, 98];
            numbers.forEach((num, i) => setTimeout(() => animateCounter(num, targets[i]), i * 200));
            statsObserver.unobserve(entry.target);
          }
        });
      });
      statsObserver.observe(statsEl);
    }

    // Reveal elements on scroll
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("shown");
            revealObserver.unobserve(entry.target);
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

    // Parallax hero
    const onScrollParallax = () => {
      const hero = document.querySelector(".hero");
      if (hero) {
        hero.style.backgroundPosition = `center ${-window.scrollY * 0.15}px`;
      }
    };
    window.addEventListener("scroll", onScrollParallax, { passive: true });

    // Cleanup
    return () => {
      window.removeEventListener("load", onWindowLoad);
      window.removeEventListener("scroll", onScrollHeader);
      window.removeEventListener("scroll", onScrollParallax);
      anchors.forEach((a) => a.removeEventListener("click", handleAnchorClick));
      observer.disconnect();
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
            <img src="/logo.png" alt="CorrectMeAi Logo" className="nav-logo" />
            <span className="logo-text">CorrectMeAi</span>
          </div>
          <ul className="nav-links">
            <li><a href="#features">Features</a></li>
            <li><a href="#pricing">Pricing</a></li>
            <li><a href="#contact">Contact</a></li>
            <li><Link to="/login" className="cta-nav">Sign in</Link></li>
            <li><Link to="/signup" className="cta-nav">Sign up</Link></li>
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
              Upload scans or photos of student exams and let CorrectMeAi perform OCR, extract answers,
              and grade against your rubric. Get instant, explainable feedback and per-question analytics.
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
            Built for real classrooms: robust OCR for handwriting, MCQs and blanks, rubric-based scoring,
            and dashboards your professors actually use.
          </p>
        </div>
        <div className="features-grid">
          {[
            { icon: "fas fa-rocket", title: "Handwriting OCR", desc: "Extract answers from scanned or photographed sheets using a production-ready OCR pipeline tuned for mixed handwriting and print." },
            { icon: "fas fa-brain", title: "Rubric-based Grading", desc: "Create rubrics per exam. CorrectMeAi aligns extracted answers to expected solutions with similarity checks and partial credit." },
            { icon: "fas fa-chart-line", title: "Per-question Analytics", desc: "Spot weak topics instantly. Drill down by question, class, or time window—export to CSV for further analysis." },
            { icon: "fas fa-shield-alt", title: "Privacy & Security", desc: "Role-based access, encrypted storage, and audit logs. Compatible with institutional policies and GDPR." },
            { icon: "fas fa-users", title: "Multi-format Questions", desc: "Supports MCQs, fill-in-the-blank, numeric answers, and “circle the correct option” formats, with flexible scoring rules." },
            { icon: "fas fa-mobile-alt", title: "Live Streaming Feedback", desc: "Watch grading stream as it happens—useful during exam import, OCR extraction, and LLM-based checks." },
          ].map((feature, i) => (
            <div key={i} className="feature-card animate-on-scroll">
              <div className="feature-icon"><i className={`fas ${feature.icon}`} /></div>
              <h3>{feature.title}</h3>
              <p>{feature.desc}</p>
            </div>
          ))}
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
          <p className="section-subtitle">
            From small classes to whole departments—start free and scale as you grow.
          </p>
        </div>
        <div className="pricing-grid">
          {[
            {
              name: "Starter (Classroom)",
              price: "$29",
              features: [
                "Up to 200 exams/month",
                "OCR + MCQ + blanks",
                "Community support",
                "Basic rubric templates",
                "Per-question stats",
              ],
              cta: "Open Web App",
            },
            {
              name: "Pro (Department)",
              price: "$79",
              features: [
                "Up to 1,000 exams/month",
                "Handwriting tuning + numeric parsing",
                "Advanced rubric rules (partial credit, ranges)",
                "Priority support",
                "Export & dashboards",
                "Custom rubrics",
                "Team roles & reviews",
              ],
              cta: "Choose Pro",
              featured: true,
            },
            {
              name: "Campus",
              price: "$199",
              features: [
                "Unlimited exams",
                "On-prem / private cloud options",
                "Full API access",
                "Dedicated success engineer",
                "Advanced analytics + SSO",
                "White-label portal",
                "SLA & security reviews",
              ],
              cta: "Talk to Sales",
            },
          ].map((plan, i) => (
            <div key={i} className={`pricing-card ${plan.featured ? "featured" : ""} animate-on-scroll`}>
              <h3 className="plan-name">{plan.name}</h3>
              <div className="price">
                {plan.price}<span>/month</span>
              </div>
              <ul className="plan-features">
                {plan.features.map((f, j) => (
                  <li key={j}>{f}</li>
                ))}
              </ul>
              <Link to="/signup" className="btn-pricing">
                {plan.cta}
              </Link>
            </div>
          ))}
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
          </div>
          <div className="footer-section">
            <h3>Support</h3>
            <p><a href="#help">Help Center</a></p>
            <p><a href="#docs">Documentation</a></p>
            <p><a href="#contact">Contact Us</a></p>
          </div>
          <div className="footer-section">
            <h3>Company</h3>
            <p><a href="#about">About Us</a></p>
            <p><a href="#blog">Blog</a></p>
          </div>
          <div className="footer-section">
            <h3>Legal</h3>
            <p><a href="#privacy">Privacy Policy</a></p>
            <p><a href="#terms">Terms of Service</a></p>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; 2025 CorrectMeAi. All rights reserved. | Made with ❤️ for educators worldwide</p>
        </div>
      </footer>
    </div>
  );
}