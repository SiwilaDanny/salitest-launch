"use client";

import Link from "next/link";
import { AppMark, platformLabel } from "@/app/dashboard/_components/AppMark";

const apps = [
  { id: "1", name: "FitTrack Pro", platform: "android", package: "com.fittrack.pro", category: "Health & Fitness", status: "active", campaigns: 2 },
  { id: "2", name: "BudgetBuddy", platform: "ios", package: "com.budgetbuddy.app", category: "Finance", status: "active", campaigns: 1 },
  { id: "3", name: "MealPrep AI", platform: "android", package: "com.mealprep.ai", category: "Food & Drink", status: "completed", campaigns: 1 },
];

const statusMap = {
  active: { cls: "badge-success", label: "Active" },
  draft: { cls: "badge-warning", label: "Draft" },
  completed: { cls: "badge-primary", label: "Completed" },
};

export default function AppsPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">My Apps</h2>
          <p className="text-sm text-base-content/40">{apps.length} apps registered</p>
        </div>
        <Link href="/dashboard/apps/new" className="btn btn-primary">+ Add New App</Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {apps.map((app) => {
          const s = statusMap[app.status];
          return (
            <div key={app.id} className="card bg-base-200 border border-base-content/5">
              <div className="card-body gap-4">
                <div className="flex items-center gap-3">
                  <AppMark name={app.name} />
                  <div className="flex-1">
                    <h3 className="font-bold">{app.name}</h3>
                    <p className="text-xs text-base-content/30 font-mono">{app.package}</p>
                  </div>
                  <span className={`badge badge-sm ${s.cls}`}>{s.label}</span>
                </div>

                <div className="flex gap-6 text-xs">
                  <div><span className="text-base-content/30">Platform</span><p className="font-semibold">{platformLabel(app.platform)}</p></div>
                  <div><span className="text-base-content/30">Category</span><p className="font-semibold">{app.category}</p></div>
                  <div><span className="text-base-content/30">Campaigns</span><p className="font-semibold">{app.campaigns}</p></div>
                </div>

                <div className="flex gap-2">
                  <Link href={`/dashboard/apps/${app.id}`} className="btn btn-outline btn-sm flex-1">View Details</Link>
                  <Link href="/dashboard/campaigns/new" className="btn btn-primary btn-sm flex-1">New Campaign</Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
