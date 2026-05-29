"use client";

import { useState } from "react";
import Link from "next/link";

/* ───── icon helpers (inline SVG) ───── */
const Icon = ({ d, size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);

const RocketIcon = () => <Icon d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09zM12 15l-3-3M22 2l-7.5 7.5M15 2H22V9M22 2L13.5 10.5" />;
const ShieldIcon = () => <Icon d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />;
const UsersIcon = () => <Icon d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />;
const CheckIcon = () => <Icon d="M20 6L9 17l-5-5" />;
const StarIcon = () => <Icon d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />;
const ZapIcon = () => <Icon d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />;
const ArrowRight = () => <Icon d="M5 12h14M12 5l7 7-7 7" size={18} />;

export default function LandingPage() {
  const [mobileNav, setMobileNav] = useState(false);

  return (
    <div style={{ background: "var(--bg-primary)", minHeight: "100vh" }}>
      {/* ═══════ NAVBAR ═══════ */}
      <nav className="navbar" style={{ maxWidth: 1400, margin: "0 auto" }}>
        <Link href="/" className="nav-logo">SaLiTeSt Launch</Link>
        <ul className="nav-links">
          <li><a href="#how" className="nav-link">How It Works</a></li>
          <li><a href="#features" className="nav-link">Features</a></li>
          <li><a href="#pricing" className="nav-link">Pricing</a></li>
          <li><Link href="/login" className="nav-link">Log In</Link></li>
          <li><Link href="/register" className="btn btn-primary">Get Started</Link></li>
        </ul>
        <button className="btn btn-icon btn-ghost" style={{ display: "none" }} onClick={() => setMobileNav(!mobileNav)}>☰</button>
      </nav>

      {/* ═══════ HERO ═══════ */}
      <section style={heroStyle}>
        {/* Glow orbs */}
        <div style={orbStyle("#6C5CE7", "10%", "-5%")} />
        <div style={orbStyle("#00CEC9", "70%", "10%")} />
        <div style={orbStyle("#FD79A8", "40%", "60%")} />

        <div className="container" style={{ position: "relative", zIndex: 2, textAlign: "center", paddingTop: "6rem", paddingBottom: "6rem" }}>
          <div className="badge badge-primary" style={{ marginBottom: "var(--space-lg)", fontSize: "var(--text-sm)" }}>
            <ZapIcon /> Trusted by 500+ Developers
          </div>
          <h1 style={heroTitleStyle}>
            Get Real Testers.<br />
            <span style={{ background: "var(--gradient-brand)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              Launch With Confidence.
            </span>
          </h1>
          <p style={heroSubStyle}>
            Meet Google Play's 12-tester closed testing requirement and Apple's TestFlight review
            with verified, fraud-free testers. Go from beta to published in 14 days.
          </p>
          <div style={{ display: "flex", gap: "var(--space-md)", justifyContent: "center", flexWrap: "wrap", marginTop: "var(--space-2xl)" }}>
            <Link href="/register?role=developer" className="btn btn-primary btn-lg">
              I'm a Developer <ArrowRight />
            </Link>
            <Link href="/register?role=tester" className="btn btn-secondary btn-lg">
              I'm a Tester <ArrowRight />
            </Link>
          </div>

          {/* Trust indicators */}
          <div style={{ display: "flex", gap: "var(--space-2xl)", justifyContent: "center", marginTop: "var(--space-3xl)", flexWrap: "wrap" }}>
            {[
              ["12+", "Verified Testers Per Campaign"],
              ["14", "Day Testing Guarantee"],
              ["99%", "Fraud Prevention Rate"],
            ].map(([val, label]) => (
              <div key={val} style={{ textAlign: "center" }}>
                <div className="stat-value" style={{ fontSize: "var(--text-3xl)" }}>{val}</div>
                <div style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)", marginTop: 4 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ HOW IT WORKS ═══════ */}
      <section id="how" style={{ padding: "var(--space-4xl) 0" }}>
        <div className="container" style={{ textAlign: "center" }}>
          <h2 style={sectionTitle}>How It Works</h2>
          <p style={sectionSub}>Three simple steps to get your app store-ready</p>

          <div style={gridThree}>
            {[
              { icon: <RocketIcon />, num: "01", title: "Submit Your App", desc: "Upload your app details, set your platform (Android/iOS), and create a testing campaign with your requirements." },
              { icon: <UsersIcon />, num: "02", title: "We Match Testers", desc: "Our platform matches you with verified, fraud-screened testers who opt-in to your closed testing track for 14 days." },
              { icon: <ShieldIcon />, num: "03", title: "Launch Verified", desc: "After 14 days of verified testing with real feedback, apply for production access with full confidence." },
            ].map((step) => (
              <div key={step.num} className="glass-card" style={{ padding: "var(--space-2xl)", textAlign: "left", position: "relative" }}>
                <div style={stepNumStyle}>{step.num}</div>
                <div style={{ width: 48, height: 48, borderRadius: "var(--radius-md)", background: "rgba(108,92,231,0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--brand-primary)", marginBottom: "var(--space-lg)" }}>
                  {step.icon}
                </div>
                <h3 style={{ fontSize: "var(--text-xl)", fontWeight: 700, marginBottom: "var(--space-sm)" }}>{step.title}</h3>
                <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", lineHeight: 1.7 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ FEATURES ═══════ */}
      <section id="features" style={{ padding: "var(--space-4xl) 0", background: "var(--bg-secondary)" }}>
        <div className="container" style={{ textAlign: "center" }}>
          <h2 style={sectionTitle}>Why SaLiTeSt Launch?</h2>
          <p style={sectionSub}>Built-in fraud prevention that protects your store accounts</p>

          <div style={{ ...gridThree, gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
            {[
              { icon: <ShieldIcon />, title: "5-Layer Fraud Prevention", desc: "Device fingerprinting, network analysis, behavioral tracking, engagement verification, and trust scoring." },
              { icon: <UsersIcon />, title: "Verified Real Testers", desc: "Every tester is identity-verified with phone OTP. No bots, no farms, no fake accounts." },
              { icon: <CheckIcon />, title: "Play Store Compliant", desc: "Designed around Google's 12-tester / 14-day closed testing requirement for new personal accounts." },
              { icon: <StarIcon />, title: "Quality Feedback", desc: "Testers provide structured feedback with ratings, bug reports, and suggestions — not just empty installs." },
              { icon: <ZapIcon />, title: "Real-Time Tracking", desc: "Monitor tester opt-ins, daily activity, and 14-day countdown in real-time from your dashboard." },
              { icon: <RocketIcon />, title: "TestFlight Ready", desc: "Full support for Apple TestFlight distribution with external beta review guidance." },
            ].map((f) => (
              <div key={f.title} className="glass-card" style={{ padding: "var(--space-xl)", textAlign: "left" }}>
                <div style={{ color: "var(--brand-secondary)", marginBottom: "var(--space-md)" }}>{f.icon}</div>
                <h3 style={{ fontSize: "var(--text-lg)", fontWeight: 700, marginBottom: "var(--space-sm)" }}>{f.title}</h3>
                <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", lineHeight: 1.7 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ PRICING ═══════ */}
      <section id="pricing" style={{ padding: "var(--space-4xl) 0" }}>
        <div className="container" style={{ textAlign: "center" }}>
          <h2 style={sectionTitle}>Simple, Transparent Pricing</h2>
          <p style={sectionSub}>Start free as a tester. Developers pay only for what they need.</p>

          <div style={{ ...gridThree, maxWidth: 1000, margin: "var(--space-2xl) auto 0" }}>
            {[
              {
                name: "Starter", price: "$29", period: "/campaign", desc: "Perfect for indie developers",
                features: ["12 verified testers", "14-day testing period", "Basic fraud protection", "Email support", "Feedback reports"],
                cta: "Get Started", highlight: false
              },
              {
                name: "Pro", price: "$79", period: "/campaign", desc: "For growing teams",
                features: ["30 verified testers", "14-day testing period", "Advanced fraud prevention", "Priority tester matching", "Real-time analytics", "Priority support"],
                cta: "Go Pro", highlight: true
              },
              {
                name: "Enterprise", price: "Custom", period: "", desc: "For agencies & studios",
                features: ["Unlimited testers", "Custom duration", "Dedicated fraud review", "Account manager", "API access", "SLA guarantee"],
                cta: "Contact Sales", highlight: false
              },
            ].map((plan) => (
              <div key={plan.name} className="glass-card" style={{
                padding: "var(--space-2xl)",
                textAlign: "left",
                position: "relative",
                border: plan.highlight ? "1px solid rgba(108,92,231,0.5)" : undefined,
                boxShadow: plan.highlight ? "var(--shadow-glow-strong)" : undefined,
              }}>
                {plan.highlight && (
                  <div className="badge badge-primary" style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)" }}>Most Popular</div>
                )}
                <h3 style={{ fontSize: "var(--text-lg)", fontWeight: 700 }}>{plan.name}</h3>
                <p style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)", marginTop: 4 }}>{plan.desc}</p>
                <div style={{ margin: "var(--space-xl) 0", display: "flex", alignItems: "baseline", gap: 4 }}>
                  <span style={{ fontSize: "var(--text-4xl)", fontWeight: 800 }}>{plan.price}</span>
                  <span style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>{plan.period}</span>
                </div>
                <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "var(--space-sm)", marginBottom: "var(--space-xl)" }}>
                  {plan.features.map((f) => (
                    <li key={f} style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ color: "var(--brand-success)" }}>✓</span> {f}
                    </li>
                  ))}
                </ul>
                <Link href="/register?role=developer" className={`btn ${plan.highlight ? "btn-primary" : "btn-secondary"}`} style={{ width: "100%" }}>
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ CTA ═══════ */}
      <section style={{ padding: "var(--space-4xl) 0", background: "var(--bg-secondary)" }}>
        <div className="container" style={{ textAlign: "center" }}>
          <h2 style={{ ...sectionTitle, marginBottom: "var(--space-md)" }}>Ready to Launch?</h2>
          <p style={{ ...sectionSub, maxWidth: 500, margin: "0 auto var(--space-xl)" }}>
            Join hundreds of developers who've successfully published their apps through verified testing.
          </p>
          <Link href="/register" className="btn btn-primary btn-lg">
            Start Your Campaign <ArrowRight />
          </Link>
        </div>
      </section>

      {/* ═══════ FOOTER ═══════ */}
      <footer style={{ padding: "var(--space-2xl) 0", borderTop: "1px solid var(--border-subtle)" }}>
        <div className="container" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--space-md)" }}>
          <span className="nav-logo" style={{ fontSize: "var(--text-lg)" }}>SaLiTeSt Launch</span>
          <p style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>
            © {new Date().getFullYear()} SaLiTeSt Launch. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

/* ───── inline styles ───── */
const heroStyle = {
  position: "relative",
  overflow: "hidden",
  background: "var(--gradient-hero)",
};

const orbStyle = (color, left, top) => ({
  position: "absolute",
  width: 500,
  height: 500,
  borderRadius: "50%",
  background: `radial-gradient(circle, ${color}22 0%, transparent 70%)`,
  left,
  top,
  filter: "blur(60px)",
  pointerEvents: "none",
});

const heroTitleStyle = {
  fontSize: "clamp(2.5rem, 6vw, 4.5rem)",
  fontWeight: 900,
  lineHeight: 1.1,
  letterSpacing: "-0.03em",
  marginBottom: "var(--space-xl)",
};

const heroSubStyle = {
  fontSize: "var(--text-lg)",
  color: "var(--text-secondary)",
  maxWidth: 600,
  margin: "0 auto",
  lineHeight: 1.7,
};

const sectionTitle = {
  fontSize: "var(--text-4xl)",
  fontWeight: 800,
  letterSpacing: "-0.02em",
  marginBottom: "var(--space-sm)",
};

const sectionSub = {
  color: "var(--text-secondary)",
  fontSize: "var(--text-lg)",
  marginBottom: "var(--space-2xl)",
};

const gridThree = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
  gap: "var(--space-xl)",
  marginTop: "var(--space-xl)",
};

const stepNumStyle = {
  position: "absolute",
  top: 16,
  right: 20,
  fontSize: "var(--text-4xl)",
  fontWeight: 900,
  color: "rgba(108, 92, 231, 0.08)",
  lineHeight: 1,
};
