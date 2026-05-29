"use client";

import { useState } from "react";
import Link from "next/link";

const myApps = [
  { id: "1", name: "FitTrack Pro", platform: "android" },
  { id: "2", name: "BudgetBuddy", platform: "ios" },
  { id: "3", name: "MealPrep AI", platform: "android" },
];

export default function NewCampaignPage() {
  const [form, setForm] = useState({
    appId: "", title: "", description: "",
    testersRequired: 12, durationDays: 14,
    rewardPerTester: 3,
    requirements: { minAndroidVersion: "", deviceTypes: [], countries: [] },
  });

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });
  const totalBudget = form.testersRequired * form.rewardPerTester;

  return (
    <div className="animate-fade-in">
      <Link href="/dashboard/campaigns" style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)", display: "inline-flex", alignItems: "center", gap: 6, marginBottom: "var(--space-xl)" }}>
        ← Back to Campaigns
      </Link>

      <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700, marginBottom: "var(--space-sm)" }}>Create New Campaign</h2>
      <p style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)", marginBottom: "var(--space-2xl)" }}>
        Set up a 14-day closed testing campaign to meet Play Store / App Store requirements
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "var(--space-xl)", alignItems: "start" }}>
        {/* Form */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xl)" }}>
          <div className="glass-card" style={{ padding: "var(--space-xl)" }}>
            <h3 style={{ fontWeight: 700, marginBottom: "var(--space-lg)" }}>Campaign Details</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
              <div className="form-group">
                <label className="form-label">Select App</label>
                <select className="form-input form-select" value={form.appId} onChange={update("appId")}>
                  <option value="">Choose an app…</option>
                  {myApps.map((a) => (
                    <option key={a.id} value={a.id}>{a.name} ({a.platform})</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Campaign Title</label>
                <input className="form-input" placeholder="e.g. FitTrack Pro — Closed Beta v1.2" value={form.title} onChange={update("title")} />
              </div>
              <div className="form-group">
                <label className="form-label">What should testers focus on?</label>
                <textarea className="form-input form-textarea" placeholder="Describe the key features you want tested, any known issues to watch for, etc." value={form.description} onChange={update("description")} />
              </div>
            </div>
          </div>

          <div className="glass-card" style={{ padding: "var(--space-xl)" }}>
            <h3 style={{ fontWeight: 700, marginBottom: "var(--space-lg)" }}>Tester Requirements</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--space-lg)" }}>
              <div className="form-group">
                <label className="form-label">Testers Needed</label>
                <input type="number" className="form-input" min={12} max={200} value={form.testersRequired} onChange={update("testersRequired")} />
                <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>Minimum: 12</span>
              </div>
              <div className="form-group">
                <label className="form-label">Duration (days)</label>
                <input type="number" className="form-input" min={14} value={form.durationDays} onChange={update("durationDays")} />
              </div>
              <div className="form-group">
                <label className="form-label">Reward / Tester ($)</label>
                <input type="number" className="form-input" min={1} step={0.5} value={form.rewardPerTester} onChange={update("rewardPerTester")} />
              </div>
            </div>

            <div style={{ marginTop: "var(--space-lg)" }} className="form-group">
              <label className="form-label">Target Countries (optional)</label>
              <select className="form-input form-select">
                <option value="">Any country</option>
                <option>United States</option>
                <option>United Kingdom</option>
                <option>Zambia</option>
                <option>South Africa</option>
                <option>Nigeria</option>
                <option>India</option>
              </select>
            </div>
          </div>
        </div>

        {/* Summary Sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
          <div className="glass-card" style={{ padding: "var(--space-xl)", border: "1px solid rgba(108,92,231,0.3)" }}>
            <h3 style={{ fontWeight: 700, marginBottom: "var(--space-lg)" }}>Campaign Summary</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
              {[
                ["Testers", `${form.testersRequired} verified`],
                ["Duration", `${form.durationDays} days`],
                ["Reward / Tester", `$${parseFloat(form.rewardPerTester).toFixed(2)}`],
                ["Platform Fee (15%)", `$${(totalBudget * 0.15).toFixed(2)}`],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-sm)" }}>
                  <span style={{ color: "var(--text-muted)" }}>{k}</span>
                  <span style={{ fontWeight: 600 }}>{v}</span>
                </div>
              ))}
              <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "var(--space-md)", display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 700 }}>Total</span>
                <span style={{ fontWeight: 800, fontSize: "var(--text-xl)", background: "var(--gradient-brand)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                  ${(totalBudget * 1.15).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <div className="glass-card" style={{ padding: "var(--space-lg)", background: "rgba(0,184,148,0.06)", border: "1px solid rgba(0,184,148,0.2)" }}>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: 1.7 }}>
              🛡️ <strong style={{ color: "var(--text-primary)" }}>Fraud Protected</strong><br />
              Every tester is verified through our 5-layer fraud prevention system before being assigned to your campaign.
            </p>
          </div>

          <button className="btn btn-primary btn-lg" style={{ width: "100%" }}>
            💳 Fund & Launch Campaign
          </button>
          <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", textAlign: "center" }}>
            Secure payment via Stripe. Funds held in escrow until testing completes.
          </p>
        </div>
      </div>
    </div>
  );
}
