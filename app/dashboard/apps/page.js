"use client";

import Link from "next/link";

const apps = [
  { id: "1", name: "FitTrack Pro", platform: "android", package: "com.fittrack.pro", category: "Health & Fitness", status: "active", campaigns: 2, icon: "🏃" },
  { id: "2", name: "BudgetBuddy", platform: "ios", package: "com.budgetbuddy.app", category: "Finance", status: "active", campaigns: 1, icon: "💰" },
  { id: "3", name: "MealPrep AI", platform: "android", package: "com.mealprep.ai", category: "Food & Drink", status: "completed", campaigns: 1, icon: "🍽️" },
];

const statusMap = {
  active: { cls: "badge-success", label: "Active" },
  draft: { cls: "badge-warning", label: "Draft" },
  completed: { cls: "badge-primary", label: "Completed" },
};

export default function AppsPage() {
  return (
    <div className="animate-fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-xl)" }}>
        <div>
          <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700 }}>My Apps</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>{apps.length} apps registered</p>
        </div>
        <Link href="/dashboard/apps/new" className="btn btn-primary">+ Add New App</Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "var(--space-lg)" }}>
        {apps.map((app) => {
          const s = statusMap[app.status];
          return (
            <div key={app.id} className="glass-card" style={{ padding: "var(--space-xl)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)", marginBottom: "var(--space-lg)" }}>
                <div style={{ width: 56, height: 56, borderRadius: "var(--radius-md)", background: "var(--bg-tertiary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "var(--text-2xl)" }}>
                  {app.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontWeight: 700 }}>{app.name}</h3>
                  <p style={{ color: "var(--text-muted)", fontSize: "var(--text-xs)", fontFamily: "var(--font-mono)" }}>{app.package}</p>
                </div>
                <span className={`badge ${s.cls}`}>{s.label}</span>
              </div>

              <div style={{ display: "flex", gap: "var(--space-xl)", marginBottom: "var(--space-lg)" }}>
                <div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>Platform</div>
                  <div style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>{app.platform === "android" ? "🤖 Android" : "🍎 iOS"}</div>
                </div>
                <div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>Category</div>
                  <div style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>{app.category}</div>
                </div>
                <div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>Campaigns</div>
                  <div style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>{app.campaigns}</div>
                </div>
              </div>

              <div style={{ display: "flex", gap: "var(--space-sm)" }}>
                <Link href={`/dashboard/apps/${app.id}`} className="btn btn-secondary btn-sm" style={{ flex: 1 }}>View Details</Link>
                <Link href="/dashboard/campaigns/new" className="btn btn-primary btn-sm" style={{ flex: 1 }}>New Campaign</Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
