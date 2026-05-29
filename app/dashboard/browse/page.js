"use client";

import { useState } from "react";

const availableApps = [
  { id: "a1", name: "FitTrack Pro", dev: "HealthTech Inc.", platform: "android", category: "Health & Fitness", reward: 3, spots: 4, total: 12, day: 3, desc: "Track workouts, calories, and health metrics with AI-powered insights.", icon: "🏃" },
  { id: "a2", name: "PixelDraw", dev: "Creative Labs", platform: "android", category: "Art & Design", reward: 4, spots: 8, total: 12, day: 0, desc: "Digital art canvas with 50+ brushes, layers, and export to social media.", icon: "🎨" },
  { id: "a3", name: "StudyMate", dev: "EduApps Co.", platform: "ios", category: "Education", reward: 5, spots: 6, total: 12, day: 0, desc: "Flashcards, quizzes, and spaced repetition for exam preparation.", icon: "📚" },
  { id: "a4", name: "RideShare Lite", dev: "MoveNow", platform: "both", category: "Travel", reward: 6, spots: 2, total: 12, day: 7, desc: "Affordable ride-sharing for short city commutes.", icon: "🚗" },
  { id: "a5", name: "PetPal", dev: "AnimalTech", platform: "android", category: "Lifestyle", reward: 3, spots: 10, total: 15, day: 0, desc: "Pet care reminders, vet finder, and social community for pet owners.", icon: "🐾" },
];

export default function BrowseAppsPage() {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = availableApps.filter((a) => {
    if (filter !== "all" && a.platform !== filter) return false;
    if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: "var(--space-xl)" }}>
        <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700 }}>Browse Testing Opportunities</h2>
        <p style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>{availableApps.length} campaigns looking for testers</p>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "var(--space-md)", marginBottom: "var(--space-xl)", flexWrap: "wrap", alignItems: "center" }}>
        <input className="form-input" placeholder="🔍 Search apps..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 300 }} />
        <div className="tabs">
          {[["all", "All"], ["android", "🤖 Android"], ["ios", "🍎 iOS"]].map(([v, l]) => (
            <button key={v} className={`tab ${filter === v ? "active" : ""}`} onClick={() => setFilter(v)}>{l}</button>
          ))}
        </div>
      </div>

      {/* App Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "var(--space-lg)" }}>
        {filtered.map((app) => (
          <div key={app.id} className="glass-card" style={{ padding: "var(--space-xl)", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)", marginBottom: "var(--space-lg)" }}>
              <div style={{ width: 52, height: 52, borderRadius: "var(--radius-md)", background: "var(--bg-tertiary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "var(--text-2xl)" }}>
                {app.icon}
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontWeight: 700 }}>{app.name}</h3>
                <p style={{ color: "var(--text-muted)", fontSize: "var(--text-xs)" }}>by {app.dev}</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "var(--text-lg)", fontWeight: 800, color: "var(--brand-success)" }}>${app.reward}</div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>reward</div>
              </div>
            </div>

            <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", lineHeight: 1.6, marginBottom: "var(--space-lg)", flex: 1 }}>{app.desc}</p>

            <div style={{ display: "flex", gap: "var(--space-lg)", marginBottom: "var(--space-lg)" }}>
              <div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>Platform</div>
                <div style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>{app.platform === "android" ? "🤖 Android" : app.platform === "ios" ? "🍎 iOS" : "📱 Both"}</div>
              </div>
              <div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>Spots Left</div>
                <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: app.spots <= 3 ? "var(--brand-danger)" : "var(--text-primary)" }}>{app.spots} of {app.total}</div>
              </div>
              <div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>Category</div>
                <div style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>{app.category}</div>
              </div>
            </div>

            <button className="btn btn-primary" style={{ width: "100%" }}>
              Apply to Test
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
