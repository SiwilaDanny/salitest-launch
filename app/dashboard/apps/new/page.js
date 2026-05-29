"use client";

import Link from "next/link";
import { useState } from "react";

export default function NewAppPage() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: "", description: "", platform: "android", category: "",
    packageName: "", bundleId: "", testingLink: "", testflightLink: "",
  });

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  return (
    <div className="animate-fade-in">
      <Link href="/dashboard/apps" style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)", display: "inline-flex", alignItems: "center", gap: 6, marginBottom: "var(--space-xl)" }}>
        ← Back to Apps
      </Link>

      <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700, marginBottom: "var(--space-sm)" }}>Register New App</h2>
      <p style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)", marginBottom: "var(--space-2xl)" }}>Add your app details to start a testing campaign</p>

      {/* Step indicator */}
      <div style={{ display: "flex", gap: "var(--space-md)", marginBottom: "var(--space-2xl)" }}>
        {["App Details", "Platform Config", "Testing Setup"].map((s, i) => (
          <div key={s} style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", flex: 1 }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "var(--text-sm)", fontWeight: 700,
              background: step > i + 1 ? "var(--brand-success)" : step === i + 1 ? "var(--brand-primary)" : "var(--bg-input)",
              color: step >= i + 1 ? "white" : "var(--text-muted)",
            }}>
              {step > i + 1 ? "✓" : i + 1}
            </div>
            <span style={{ fontSize: "var(--text-sm)", color: step === i + 1 ? "var(--text-primary)" : "var(--text-muted)", fontWeight: step === i + 1 ? 600 : 400 }}>{s}</span>
            {i < 2 && <div style={{ flex: 1, height: 1, background: "var(--border-subtle)", marginLeft: "var(--space-sm)" }} />}
          </div>
        ))}
      </div>

      <div className="glass-card" style={{ padding: "var(--space-2xl)", maxWidth: 600 }}>
        {step === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
            <div className="form-group">
              <label className="form-label">App Name</label>
              <input className="form-input" placeholder="My Awesome App" value={form.name} onChange={update("name")} />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="form-input form-textarea" placeholder="What does your app do?" value={form.description} onChange={update("description")} />
            </div>
            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="form-input form-select" value={form.category} onChange={update("category")}>
                <option value="">Select category</option>
                {["Games", "Social", "Productivity", "Health & Fitness", "Finance", "Education", "Entertainment", "Food & Drink", "Travel", "Utilities", "Other"].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
            <div className="form-group">
              <label className="form-label">Target Platform</label>
              <div style={{ display: "flex", gap: "var(--space-md)" }}>
                {[["android", "🤖 Android"], ["ios", "🍎 iOS"], ["both", "📱 Both"]].map(([val, lbl]) => (
                  <button key={val} className={`btn ${form.platform === val ? "btn-primary" : "btn-secondary"}`} onClick={() => setForm({ ...form, platform: val })}>{lbl}</button>
                ))}
              </div>
            </div>
            {(form.platform === "android" || form.platform === "both") && (
              <div className="form-group">
                <label className="form-label">Package Name</label>
                <input className="form-input" placeholder="com.example.myapp" value={form.packageName} onChange={update("packageName")} style={{ fontFamily: "var(--font-mono)" }} />
              </div>
            )}
            {(form.platform === "ios" || form.platform === "both") && (
              <div className="form-group">
                <label className="form-label">Bundle ID</label>
                <input className="form-input" placeholder="com.example.myapp" value={form.bundleId} onChange={update("bundleId")} style={{ fontFamily: "var(--font-mono)" }} />
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
            <div style={{ background: "rgba(108,92,231,0.08)", border: "1px solid rgba(108,92,231,0.2)", borderRadius: "var(--radius-md)", padding: "var(--space-lg)", fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: 1.7 }}>
              <strong style={{ color: "var(--text-primary)" }}>📋 Setup Instructions:</strong><br />
              1. Go to Google Play Console → Testing → Closed Testing<br />
              2. Create a new closed test track<br />
              3. Copy the opt-in URL and paste it below
            </div>
            {(form.platform === "android" || form.platform === "both") && (
              <div className="form-group">
                <label className="form-label">Closed Testing Opt-in Link</label>
                <input className="form-input" placeholder="https://play.google.com/apps/testing/..." value={form.testingLink} onChange={update("testingLink")} />
              </div>
            )}
            {(form.platform === "ios" || form.platform === "both") && (
              <div className="form-group">
                <label className="form-label">TestFlight Link</label>
                <input className="form-input" placeholder="https://testflight.apple.com/join/..." value={form.testflightLink} onChange={update("testflightLink")} />
              </div>
            )}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "var(--space-2xl)" }}>
          {step > 1 ? (
            <button className="btn btn-secondary" onClick={() => setStep(step - 1)}>← Previous</button>
          ) : <div />}
          {step < 3 ? (
            <button className="btn btn-primary" onClick={() => setStep(step + 1)}>Next →</button>
          ) : (
            <Link href="/dashboard/apps" className="btn btn-primary">✓ Register App</Link>
          )}
        </div>
      </div>
    </div>
  );
}
