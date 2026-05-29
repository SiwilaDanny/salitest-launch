"use client";

import Link from "next/link";

/* ─── Demo data ─── */
const stats = [
  { value: "3", label: "Active Campaigns", change: "+1 this week", positive: true },
  { value: "28", label: "Total Testers", change: "+12 this week", positive: true },
  { value: "86%", label: "Completion Rate", change: "+5%", positive: true },
  { value: "$127", label: "Total Spent", change: "2 campaigns", positive: true },
];

const campaigns = [
  { id: 1, app: "FitTrack Pro", platform: "android", testers: 12, required: 12, day: 11, status: "in_progress" },
  { id: 2, app: "BudgetBuddy", platform: "ios", testers: 8, required: 12, day: 3, status: "recruiting" },
  { id: 3, app: "MealPrep AI", platform: "android", testers: 12, required: 12, day: 14, status: "completed" },
];

const recentActivity = [
  { text: "Tester @sarah_k opted in to FitTrack Pro", time: "2 hours ago", type: "success" },
  { text: "New feedback received for MealPrep AI", time: "5 hours ago", type: "info" },
  { text: "Campaign BudgetBuddy needs 4 more testers", time: "1 day ago", type: "warning" },
  { text: "⚠️ Suspicious tester flagged on FitTrack Pro", time: "1 day ago", type: "danger" },
];

const platformBadge = (p) => p === "android" ? "🤖 Android" : "🍎 iOS";
const statusBadge = (s) => ({
  in_progress: { cls: "badge-primary", label: "In Progress" },
  recruiting: { cls: "badge-warning", label: "Recruiting" },
  completed: { cls: "badge-success", label: "Completed" },
})[s] || { cls: "badge-info", label: s };

export default function DashboardOverview() {
  return (
    <div className="animate-fade-in">
      {/* Stat Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "var(--space-lg)", marginBottom: "var(--space-2xl)" }}>
        {stats.map((s) => (
          <div key={s.label} className="glass-card stat-card">
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
            <div className={`stat-change ${s.positive ? "positive" : "negative"}`}>
              {s.positive ? "↑" : "↓"} {s.change}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "var(--space-xl)" }}>
        {/* Active Campaigns */}
        <div className="glass-card" style={{ padding: "var(--space-xl)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-lg)" }}>
            <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 700 }}>Active Campaigns</h2>
            <Link href="/dashboard/campaigns" className="btn btn-sm btn-ghost" style={{ color: "var(--text-accent)" }}>View All →</Link>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
            {campaigns.map((c) => {
              const sb = statusBadge(c.status);
              const progress = Math.round((c.day / 14) * 100);
              return (
                <div key={c.id} style={{ padding: "var(--space-lg)", background: "var(--bg-glass)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-sm)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
                      <div className="avatar-sm avatar">{c.app[0]}</div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}>{c.app}</div>
                        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>{platformBadge(c.platform)}</div>
                      </div>
                    </div>
                    <span className={`badge ${sb.cls}`}>{sb.label}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-xs)", color: "var(--text-muted)", marginBottom: 6 }}>
                    <span>{c.testers}/{c.required} testers</span>
                    <span>Day {c.day}/14</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          <Link href="/dashboard/campaigns/new" className="btn btn-primary" style={{ width: "100%", marginTop: "var(--space-lg)" }}>
            + New Campaign
          </Link>
        </div>

        {/* Activity Feed */}
        <div className="glass-card" style={{ padding: "var(--space-xl)" }}>
          <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 700, marginBottom: "var(--space-lg)" }}>Recent Activity</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
            {recentActivity.map((a, i) => (
              <div key={i} style={{ display: "flex", gap: "var(--space-md)", alignItems: "flex-start", padding: "var(--space-sm) 0", borderBottom: i < recentActivity.length - 1 ? "1px solid var(--border-subtle)" : "none" }}>
                <div style={{
                  width: 8, height: 8, borderRadius: "50%", marginTop: 6, flexShrink: 0,
                  background: a.type === "success" ? "var(--brand-success)" : a.type === "warning" ? "var(--brand-warning)" : a.type === "danger" ? "var(--brand-danger)" : "var(--brand-secondary)"
                }} />
                <div>
                  <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: 1.5 }}>{a.text}</p>
                  <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: 2 }}>{a.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
