"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppMark, platformLabel } from "@/app/dashboard/_components/AppMark";
import { createClient } from "@/lib/supabase/client";

const statusMap = {
  pending: { cls: "border-info/25 bg-info/10 text-info", label: "Pending" },
  funded: { cls: "border-info/25 bg-info/10 text-info", label: "Funded" },
  in_progress: { cls: "border-secondary/25 bg-secondary/10 text-secondary", label: "In Progress" },
  recruiting: { cls: "border-warning/25 bg-warning/10 text-warning", label: "Recruiting" },
  verification: { cls: "border-accent/25 bg-accent/10 text-accent", label: "Verification" },
  completed: { cls: "border-success/25 bg-success/10 text-success", label: "Completed" },
  cancelled: { cls: "border-error/25 bg-error/10 text-error", label: "Cancelled" },
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadedAt, setLoadedAt] = useState(null);

  useEffect(() => {
    async function loadCampaigns() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setError("Please sign in to view campaigns.");
          return;
        }

        const { data, error: dbError } = await supabase
          .from("campaigns")
          .select(`
            id, title, platform, testers_required, testers_enrolled, duration_days,
            reward_per_tester, budget_total, status, starts_at, created_at,
            apps ( name ),
            campaign_tasks ( id )
          `)
          .eq("developer_id", user.id)
          .order("created_at", { ascending: false });

        if (dbError) throw dbError;
        setCampaigns(data || []);
        setLoadedAt(Date.now());
      } catch (err) {
        setError(err?.message || "Failed to load campaigns.");
      } finally {
        setLoading(false);
      }
    }

    loadCampaigns();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">Campaigns</h2>
          <p className="text-sm text-base-content/40">Manage your testing campaigns and daily task plans</p>
        </div>
        <Link href="/dashboard/campaigns/new" className="btn btn-primary">+ New Campaign</Link>
      </div>

      {error ? <div className="alert alert-error text-sm">{error}</div> : null}

      {loading ? (
        <div className="grid min-h-40 place-items-center rounded-lg border border-base-content/5 bg-base-200">
          <span className="loading loading-spinner text-primary" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="rounded-lg border border-base-content/5 bg-base-200 p-8 text-center">
          <h3 className="font-bold">No campaigns yet</h3>
          <p className="mt-1 text-sm text-base-content/50">Create a campaign and add daily tasks for testers to follow.</p>
          <Link href="/dashboard/campaigns/new" className="btn btn-primary btn-sm mt-4">Create Campaign</Link>
        </div>
      ) : (
      <div className="overflow-x-auto rounded-lg border border-base-content/5">
        <table className="table table-sm">
          <thead>
            <tr className="bg-base-200">
              <th>App</th>
              <th>Platform</th>
              <th>Testers</th>
              <th>Progress</th>
              <th>Tasks</th>
              <th>Reward</th>
              <th>Budget</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => {
              const s = statusMap[c.status] || statusMap.pending;
              const duration = Number(c.duration_days) || 14;
              const started = c.starts_at ? new Date(c.starts_at) : null;
              const elapsed = started && loadedAt ? Math.max(1, Math.ceil((loadedAt - started.getTime()) / 86400000)) : 0;
              const day = Math.min(duration, elapsed);
              const progress = day ? Math.round((day / duration) * 100) : 0;
              const appName = c.apps?.name || c.title;
              return (
                <tr key={c.id} className="hover">
                  <td>
                    <div className="flex items-center gap-3">
                      <AppMark name={appName} size="sm" />
                      <span className="font-semibold">{appName}</span>
                    </div>
                  </td>
                  <td className="text-sm">{platformLabel(c.platform)}</td>
                  <td className="font-semibold">{c.testers_enrolled || 0}/{c.testers_required}</td>
                  <td className="min-w-[140px]">
                    <div className="flex items-center gap-2">
                      <progress className="progress progress-primary w-20 h-1.5" value={progress} max="100" />
                      <span className="text-xs text-base-content/30">{day ? `Day ${day}/${duration}` : "Not started"}</span>
                    </div>
                  </td>
                  <td className="font-semibold">{c.campaign_tasks?.length || 0}</td>
                  <td className="font-mono">${Number(c.reward_per_tester || 0).toFixed(2)}</td>
                  <td className="font-mono">${Number(c.budget_total || 0).toFixed(2)}</td>
                  <td>
                    <span className={`inline-flex h-6 min-w-24 items-center justify-center rounded-full border px-3 text-[11px] font-bold leading-none ${s.cls}`}>
                      {s.label}
                    </span>
                  </td>
                  <td><Link href={`/dashboard/campaigns/${c.id}`} className="link link-primary text-sm">View →</Link></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}
