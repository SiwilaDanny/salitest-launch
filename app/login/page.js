"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      window.location.href = "/dashboard";
    } catch (err) {
      setError(err.message || "An unexpected error occurred");
      setLoading(false);
    }
  };

  return (
    <div style={pageStyle}>
      {/* Background effects */}
      <div style={bgOrb("#6C5CE7", "10%", "20%")} />
      <div style={bgOrb("#00CEC9", "80%", "70%")} />

      <div style={cardStyle} className="animate-slide-up">
        <Link href="/" className="nav-logo" style={{ display: "block", textAlign: "center", marginBottom: "var(--space-2xl)", fontSize: "var(--text-2xl)" }}>
          SaLiTeSt Launch
        </Link>

        <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 800, textAlign: "center", marginBottom: 4 }}>Welcome Back</h1>
        <p style={{ color: "var(--text-muted)", textAlign: "center", fontSize: "var(--text-sm)", marginBottom: "var(--space-2xl)" }}>
          Sign in to manage your testing campaigns
        </p>

        {error && (
          <div style={{ background: "rgba(255,118,117,0.1)", border: "1px solid rgba(255,118,117,0.3)", borderRadius: "var(--radius-md)", padding: "var(--space-md)", marginBottom: "var(--space-lg)", color: "#FF7675", fontSize: "var(--text-sm)" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email Address</label>
            <input id="email" type="email" className="form-input" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>

          <div className="form-group">
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <label className="form-label" htmlFor="password">Password</label>
              <a href="#" style={{ fontSize: "var(--text-xs)", color: "var(--text-accent)" }}>Forgot password?</a>
            </div>
            <input id="password" type="password" className="form-input" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>

          <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ width: "100%" }}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: "var(--space-xl)", fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
          Don&apos;t have an account?{" "}
          <Link href="/register" style={{ color: "var(--text-accent)", fontWeight: 600 }}>Sign Up</Link>
        </div>
      </div>
    </div>
  );
}

const pageStyle = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--gradient-hero)",
  position: "relative",
  overflow: "hidden",
  padding: "var(--space-xl)",
};

const cardStyle = {
  background: "rgba(17, 17, 40, 0.8)",
  border: "1px solid var(--border-default)",
  borderRadius: "var(--radius-xl)",
  backdropFilter: "blur(20px)",
  padding: "var(--space-2xl)",
  width: "100%",
  maxWidth: 440,
  position: "relative",
  zIndex: 2,
};

const bgOrb = (color, left, top) => ({
  position: "absolute",
  width: 400,
  height: 400,
  borderRadius: "50%",
  background: `radial-gradient(circle, ${color}20 0%, transparent 70%)`,
  left, top,
  filter: "blur(80px)",
  pointerEvents: "none",
});
