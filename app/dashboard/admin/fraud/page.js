"use client";

import Link from "next/link";

const flaggedUsers = [
  {
    id: "u1", name: "John Smith", email: "john.s***@gmail.com", trustScore: 18,
    flags: ["VPN detected", "Multiple accounts from same device", "Bot-like click pattern"],
    severity: "critical", device: "Emulator (Android 13)", ip: "185.x.x.x (Data Center)", joined: "2 days ago"
  },
  {
    id: "u2", name: "TestUser_2847", email: "test2***@yandex.com", trustScore: 25,
    flags: ["Rapid form completion (2s)", "No scroll events", "Generic feedback text"],
    severity: "high", device: "Chrome / Windows 10", ip: "45.x.x.x (VPN)", joined: "1 day ago"
  },
  {
    id: "u3", name: "Maria Chen", email: "maria.c***@outlook.com", trustScore: 42,
    flags: ["Device fingerprint matches user #u4"],
    severity: "medium", device: "Samsung Galaxy S22", ip: "102.x.x.x (Zambia)", joined: "5 days ago"
  },
];

const severityColor = {
  critical: { bg: "rgba(255,118,117,0.12)", border: "rgba(255,118,117,0.3)", text: "#FF7675" },
  high: { bg: "rgba(253,121,168,0.12)", border: "rgba(253,121,168,0.3)", text: "#FD79A8" },
  medium: { bg: "rgba(253,203,110,0.12)", border: "rgba(253,203,110,0.3)", text: "#FDCB6E" },
};

export default function FraudReviewPage() {
  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: "var(--space-xl)" }}>
        <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700 }}>Fraud Review Queue</h2>
        <p style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>{flaggedUsers.length} users flagged for review</p>
      </div>

      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--space-lg)", marginBottom: "var(--space-2xl)" }}>
        {[
          { value: "3", label: "Pending Review", cls: "badge-danger" },
          { value: "12", label: "Resolved Today", cls: "badge-success" },
          { value: "97.2%", label: "Detection Rate", cls: "badge-primary" },
          { value: "0", label: "False Positives", cls: "badge-info" },
        ].map((s) => (
          <div key={s.label} className="glass-card stat-card">
            <div className="stat-value" style={{ fontSize: "var(--text-2xl)" }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Flagged Users */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
        {flaggedUsers.map((user) => {
          const sc = severityColor[user.severity];
          const trustClass = user.trustScore < 30 ? "trust-low" : user.trustScore < 50 ? "trust-medium" : "trust-high";
          return (
            <div key={user.id} className="glass-card" style={{ padding: "var(--space-xl)", borderLeft: `3px solid ${sc.text}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--space-lg)" }}>
                <div style={{ display: "flex", gap: "var(--space-lg)", alignItems: "center" }}>
                  <div className={`trust-meter ${trustClass}`}>
                    <span className="trust-meter-value">{user.trustScore}</span>
                  </div>
                  <div>
                    <h3 style={{ fontWeight: 700, fontSize: "var(--text-lg)" }}>{user.name}</h3>
                    <p style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>{user.email}</p>
                    <p style={{ color: "var(--text-muted)", fontSize: "var(--text-xs)", marginTop: 2 }}>Joined {user.joined}</p>
                  </div>
                </div>
                <span className="badge" style={{ background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {user.severity}
                </span>
              </div>

              {/* Fraud flags */}
              <div style={{ marginBottom: "var(--space-lg)" }}>
                <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "var(--space-sm)" }}>Fraud Indicators</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-sm)" }}>
                  {user.flags.map((f) => (
                    <span key={f} style={{ background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`, padding: "4px 10px", borderRadius: "var(--radius-full)", fontSize: "var(--text-xs)", fontWeight: 500 }}>
                      ⚠ {f}
                    </span>
                  ))}
                </div>
              </div>

              {/* Device / Network info */}
              <div style={{ display: "flex", gap: "var(--space-2xl)", marginBottom: "var(--space-lg)", flexWrap: "wrap" }}>
                <div>
                  <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>Device</p>
                  <p style={{ fontSize: "var(--text-sm)", fontFamily: "var(--font-mono)" }}>{user.device}</p>
                </div>
                <div>
                  <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>IP Address</p>
                  <p style={{ fontSize: "var(--text-sm)", fontFamily: "var(--font-mono)" }}>{user.ip}</p>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: "var(--space-sm)" }}>
                <button className="btn btn-sm" style={{ background: "rgba(0,184,148,0.12)", color: "var(--brand-success)", border: "1px solid rgba(0,184,148,0.3)" }}>✓ Approve</button>
                <button className="btn btn-sm" style={{ background: "rgba(255,118,117,0.12)", color: "var(--brand-danger)", border: "1px solid rgba(255,118,117,0.3)" }}>✕ Ban User</button>
                <button className="btn btn-sm btn-ghost">🔍 Investigate</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
