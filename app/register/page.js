"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/client";

function RegisterForm() {
  const searchParams = useSearchParams();
  const initialRole = searchParams.get("role") || "developer";

  const [role, setRole] = useState(initialRole);
  const [form, setForm] = useState({ fullName: "", email: "", password: "", confirmPassword: "", country: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleRegister = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) { setError("Passwords do not match"); return; }
    setLoading(true);
    setError("");

    try {
      const supabase = createClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            full_name: form.fullName,
            role: role,
            country: form.country,
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      if (data?.session) {
        window.location.href = "/dashboard";
      } else {
        // If email confirmation is enabled, notify user
        setError("Account created! Please check your email to verify before signing in.");
        setLoading(false);
      }
    } catch (err) {
      setError(err.message || "An unexpected error occurred");
      setLoading(false);
    }
  };

  return (
    <div style={cardStyle} className="animate-slide-up">
      <Link href="/" className="nav-logo" style={{ display: "block", textAlign: "center", marginBottom: "var(--space-xl)", fontSize: "var(--text-2xl)" }}>
        SaLiTeSt Launch
      </Link>

      <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 800, textAlign: "center", marginBottom: 4 }}>Create Account</h1>
      <p style={{ color: "var(--text-muted)", textAlign: "center", fontSize: "var(--text-sm)", marginBottom: "var(--space-xl)" }}>
        Join the app testing marketplace
      </p>

      {/* Role Switcher */}
      <div className="tabs" style={{ marginBottom: "var(--space-xl)" }}>
        <button className={`tab ${role === "developer" ? "active" : ""}`} onClick={() => setRole("developer")} style={{ flex: 1 }}>
          🚀 I&apos;m a Developer
        </button>
        <button className={`tab ${role === "tester" ? "active" : ""}`} onClick={() => setRole("tester")} style={{ flex: 1 }}>
          🧪 I&apos;m a Tester
        </button>
      </div>

      {error && (
        <div style={{ background: "rgba(255,118,117,0.1)", border: "1px solid rgba(255,118,117,0.3)", borderRadius: "var(--radius-md)", padding: "var(--space-md)", marginBottom: "var(--space-lg)", color: "#FF7675", fontSize: "var(--text-sm)" }}>
          {error}
        </div>
      )}

      <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
        <div className="form-group">
          <label className="form-label" htmlFor="fullName">Full Name</label>
          <input id="fullName" className="form-input" placeholder="John Doe" value={form.fullName} onChange={update("fullName")} required />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="regEmail">Email Address</label>
          <input id="regEmail" type="email" className="form-input" placeholder="you@example.com" value={form.email} onChange={update("email")} required />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-md)" }}>
          <div className="form-group">
            <label className="form-label" htmlFor="regPass">Password</label>
            <input id="regPass" type="password" className="form-input" placeholder="••••••••" value={form.password} onChange={update("password")} required />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="regPassConfirm">Confirm</label>
            <input id="regPassConfirm" type="password" className="form-input" placeholder="••••••••" value={form.confirmPassword} onChange={update("confirmPassword")} required />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="country">Country</label>
          <select id="country" className="form-input form-select" value={form.country} onChange={update("country")} required>
            <option value="">Select your country</option>
            <option value="US">United States</option>
            <option value="GB">United Kingdom</option>
            <option value="ZM">Zambia</option>
            <option value="ZA">South Africa</option>
            <option value="NG">Nigeria</option>
            <option value="KE">Kenya</option>
            <option value="IN">India</option>
            <option value="DE">Germany</option>
            <option value="OTHER">Other</option>
          </select>
        </div>

        {role === "tester" && (
          <div style={{ background: "rgba(0,206,201,0.08)", border: "1px solid rgba(0,206,201,0.2)", borderRadius: "var(--radius-md)", padding: "var(--space-md)", fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
            🧪 As a tester, you&apos;ll earn rewards for genuinely testing apps. Identity verification will be required before your first campaign.
          </div>
        )}

        {role === "developer" && (
          <div style={{ background: "rgba(108,92,231,0.08)", border: "1px solid rgba(108,92,231,0.2)", borderRadius: "var(--radius-md)", padding: "var(--space-md)", fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
            🚀 As a developer, you can create testing campaigns and get verified testers for your apps.
          </div>
        )}

        <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ width: "100%" }}>
          {loading ? "Creating Account..." : `Create ${role === "developer" ? "Developer" : "Tester"} Account`}
        </button>
      </form>

      <div style={{ textAlign: "center", marginTop: "var(--space-xl)", fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
        Already have an account?{" "}
        <Link href="/login" style={{ color: "var(--text-accent)", fontWeight: 600 }}>Sign In</Link>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <div style={pageStyle}>
      <div style={bgOrb("#6C5CE7", "10%", "20%")} />
      <div style={bgOrb("#00CEC9", "80%", "70%")} />
      <Suspense fallback={<div style={{ color: "var(--text-muted)" }}>Loading...</div>}>
        <RegisterForm />
      </Suspense>
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
  maxWidth: 500,
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
