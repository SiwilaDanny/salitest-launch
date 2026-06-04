"use client";

import { useState } from "react";
import { AppMark, platformLabel } from "@/app/dashboard/_components/AppMark";

const availableApps = [
  { id: "a1", name: "FitTrack Pro", dev: "HealthTech Inc.", platform: "android", category: "Health & Fitness", reward: 3, spots: 4, total: 12, desc: "Track workouts, calories, and health metrics with AI-powered insights." },
  { id: "a2", name: "PixelDraw", dev: "Creative Labs", platform: "android", category: "Art & Design", reward: 4, spots: 8, total: 12, desc: "Digital art canvas with 50+ brushes, layers, and export to social media." },
  { id: "a3", name: "StudyMate", dev: "EduApps Co.", platform: "ios", category: "Education", reward: 5, spots: 6, total: 12, desc: "Flashcards, quizzes, and spaced repetition for exam preparation." },
  { id: "a4", name: "RideShare Lite", dev: "MoveNow", platform: "both", category: "Travel", reward: 6, spots: 2, total: 12, desc: "Affordable ride-sharing for short city commutes." },
  { id: "a5", name: "PetPal", dev: "AnimalTech", platform: "android", category: "Lifestyle", reward: 3, spots: 10, total: 15, desc: "Pet care reminders, vet finder, and social community for pet owners." },
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
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Browse Testing Opportunities</h2>
        <p className="text-sm text-base-content/40">{availableApps.length} campaigns looking for testers</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input className="input input-bordered input-sm w-64" placeholder="Search apps..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="tabs tabs-boxed tabs-sm bg-base-300 p-0.5">
          {[["all", "All"], ["android", "Android"], ["ios", "iOS"]].map(([v, l]) => (
            <button key={v} className={`tab ${filter === v ? "tab-active" : ""}`} onClick={() => setFilter(v)}>{l}</button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filtered.map((app) => (
          <div key={app.id} className="card bg-base-200 border border-base-content/5 hover:border-primary/20 transition-all">
            <div className="card-body gap-4">
              <div className="flex items-center gap-3">
                <AppMark name={app.name} />
                <div className="flex-1">
                  <h3 className="font-bold">{app.name}</h3>
                  <p className="text-xs text-base-content/30">by {app.dev}</p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-extrabold text-success">${app.reward}</div>
                  <div className="text-[10px] text-base-content/30">reward</div>
                </div>
              </div>

              <p className="text-sm text-base-content/50 leading-relaxed flex-1">{app.desc}</p>

              <div className="flex gap-6 text-xs">
                <div>
                  <span className="text-base-content/30">Platform</span>
                  <p className="font-semibold">{platformLabel(app.platform)}</p>
                </div>
                <div>
                  <span className="text-base-content/30">Spots Left</span>
                  <p className={`font-semibold ${app.spots <= 3 ? "text-error" : ""}`}>{app.spots} of {app.total}</p>
                </div>
                <div>
                  <span className="text-base-content/30">Category</span>
                  <p className="font-semibold">{app.category}</p>
                </div>
              </div>

              <button className="btn btn-primary btn-block">Apply to Test</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
