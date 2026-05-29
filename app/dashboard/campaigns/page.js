"use client";

import Link from "next/link";

const campaigns = [
  { id: "c1", app: "FitTrack Pro", icon: "🏃", platform: "android", testers: 12, required: 12, day: 11, status: "in_progress", reward: 3, budget: 36 },
  { id: "c2", app: "BudgetBuddy", icon: "💰", platform: "ios", testers: 8, required: 12, day: 3, status: "recruiting", reward: 5, budget: 60 },
  { id: "c3", app: "MealPrep AI", icon: "🍽️", platform: "android", testers: 12, required: 12, day: 14, status: "completed", reward: 3, budget: 36 },
];

const statusMap = {
  in_progress: { cls: "badge-primary", label: "In Progress" },
  recruiting: { cls: "badge-warning", label: "Recruiting" },
  completed: { cls: "badge-success", label: "Completed" },
  pending: { cls: "badge-info", label: "Pending" },
};

export default function CampaignsPage() {
  return (
    <div className="animate-fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-xl)" }}>
        <div>
          <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700 }}>Campaigns</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>Manage your testing campaigns</p>
        </div>
        <Link href="/dashboard/campaigns/new" className="btn btn-primary">+ New Campaign</Link>
      </div>

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>App</th>
              <th>Platform</th>
              <th>Testers</th>
              <th>Progress</th>
              <th>Reward/Tester</th>
              <th>Budget</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => {
              const s = statusMap[c.status];
              const progress = Math.round((c.day / 14) * 100);
              return (
                <tr key={c.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
                      <span style={{ fontSize: "var(--text-xl)" }}>{c.icon}</span>
                      <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{c.app}</span>
                    </div>
                  </td>
                  <td>{c.platform === "android" ? "🤖 Android" : "🍎 iOS"}</td>
                  <td style={{ fontWeight: 600 }}>{c.testers}/{c.required}</td>
                  <td style={{ minWidth: 140 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
                      <div className="progress-bar" style={{ flex: 1 }}>
                        <div className="progress-fill" style={{ width: `${progress}%` }} />
                      </div>
                      <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", whiteSpace: "nowrap" }}>Day {c.day}/14</span>
                    </div>
                  </td>
                  <td style={{ fontFamily: "var(--font-mono)" }}>${c.reward}</td>
                  <td style={{ fontFamily: "var(--font-mono)" }}>${c.budget}</td>
                  <td><span className={`badge ${s.cls}`}>{s.label}</span></td>
                  <td>
                    <Link href={`/dashboard/campaigns/${c.id}`} className="btn btn-sm btn-ghost" style={{ color: "var(--text-accent)" }}>View →</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
