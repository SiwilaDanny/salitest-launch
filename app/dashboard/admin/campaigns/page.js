"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

const statusBadge = {
  pending: "badge-warning",
  funded: "badge-info",
  recruiting: "badge-accent",
  in_progress: "badge-primary",
  verification: "badge-secondary",
  completed: "badge-success",
  cancelled: "badge-error",
  suspended: "badge-error",
};

export default function AdminCampaignsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [updatingId, setUpdatingId] = useState(null);
  const [alertMsg, setAlertMsg] = useState(null);

  const supabase = createClient();

  const fetchCampaigns = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      let query = supabase
        .from("campaigns")
        .select("*, apps(name, platform), profiles!campaigns_developer_id_fkey(full_name, email)")
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error: fetchErr } = await query;
      if (fetchErr) throw fetchErr;
      setCampaigns(data || []);
    } catch (err) {
      console.error("Error fetching campaigns:", err);
      setError("Failed to load campaigns. Verify admin RLS permissions.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  async function handleStatusChange(campaignId, newStatus) {
    try {
      setUpdatingId(campaignId);
      const { error: updateErr } = await supabase
        .from("campaigns")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", campaignId);

      if (updateErr) throw updateErr;
      setCampaigns(prev =>
        prev.map(c => (c.id === campaignId ? { ...c, status: newStatus } : c))
      );
      setAlertMsg({ type: "success", text: `Campaign status updated to "${newStatus}".` });
    } catch (err) {
      console.error("Error updating campaign:", err);
      setAlertMsg({ type: "error", text: err.message || "Failed to update campaign status." });
    } finally {
      setUpdatingId(null);
    }
  }

  if (loading) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <div className="flex flex-col items-center gap-2">
          <span className="loading loading-spinner loading-lg text-primary" />
          <p className="text-xs text-base-content/40 font-semibold tracking-wider uppercase">
            Loading campaigns...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">Campaign Review</h2>
          <p className="text-sm text-base-content/45">
            Audit, approve, suspend, or cancel campaigns across the platform.
          </p>
        </div>
        <span className="badge badge-primary badge-outline font-bold px-3 py-3">
          {campaigns.length} Campaigns
        </span>
      </div>

      {alertMsg && (
        <div className={`alert ${alertMsg.type === "success" ? "alert-success" : "alert-error"} shadow-sm flex justify-between`}>
          <span>{alertMsg.text}</span>
          <button className="btn btn-ghost btn-xs" onClick={() => setAlertMsg(null)}>✕</button>
        </div>
      )}

      {error && (
        <div className="alert alert-error shadow-sm">
          <span>{error}</span>
        </div>
      )}

      {/* Status Filter */}
      <div className="card bg-base-200 border border-base-content/5 shadow-md p-4">
        <div className="flex items-center gap-4">
          <label className="text-[10px] font-bold uppercase tracking-wider text-base-content/50 whitespace-nowrap">
            Filter by Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="select select-bordered select-sm bg-base-300 w-48"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="funded">Funded</option>
            <option value="recruiting">Recruiting</option>
            <option value="in_progress">In Progress</option>
            <option value="verification">Verification</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {campaigns.length === 0 ? (
        <div className="card bg-base-200 border border-base-content/5 shadow-md p-8 text-center space-y-1">
          <p className="text-base font-bold text-base-content/60">No campaigns found</p>
          <p className="text-xs text-base-content/40">Try changing the status filter or check back later.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {campaigns.map((campaign) => (
            <div
              key={campaign.id}
              className="card bg-base-200 border border-base-content/5 shadow-md p-5 gap-4 hover:shadow-lg transition-shadow duration-200"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-extrabold text-base-content text-lg">{campaign.title}</h3>
                    <span className={`badge ${statusBadge[campaign.status] || "badge-ghost"} text-[10px] font-extrabold uppercase px-2`}>
                      {campaign.status}
                    </span>
                    <span className="badge badge-outline badge-sm text-[10px] font-bold text-base-content/50">
                      {campaign.platform}
                    </span>
                  </div>
                  <p className="text-xs text-base-content/50">
                    App: <strong>{campaign.apps?.name || "Unknown"}</strong>
                    {" · "}Developer: <strong>{campaign.profiles?.full_name || campaign.profiles?.email || "Unknown"}</strong>
                  </p>
                </div>
                <div className="text-left sm:text-right space-y-1">
                  <p className="text-lg font-black text-base-content">
                    ${parseFloat(campaign.budget_total || 0).toFixed(2)}
                  </p>
                  <p className="text-[10px] text-base-content/40">
                    ${parseFloat(campaign.reward_per_tester || 0).toFixed(2)}/tester × {campaign.testers_required}
                  </p>
                </div>
              </div>

              {/* Campaign Details */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-3 border-y border-base-content/5">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-base-content/40">Enrolled</p>
                  <p className="text-sm font-bold text-base-content mt-0.5">
                    {campaign.testers_enrolled || 0} / {campaign.testers_required}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-base-content/40">Duration</p>
                  <p className="text-sm font-bold text-base-content mt-0.5">{campaign.duration_days} days</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-base-content/40">Platform Fee</p>
                  <p className="text-sm font-bold text-base-content mt-0.5">{parseFloat(campaign.platform_fee_pct || 15).toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-base-content/40">Created</p>
                  <p className="text-sm font-bold text-base-content mt-0.5">
                    {new Date(campaign.created_at).toLocaleDateString(undefined, {
                      year: "numeric", month: "short", day: "numeric",
                    })}
                  </p>
                </div>
              </div>

              {campaign.description && (
                <p className="text-xs text-base-content/60 bg-base-300 rounded-lg p-3 border border-base-content/5">
                  {campaign.description}
                </p>
              )}

              {/* Admin Actions */}
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-base-content/40 mr-2">Actions:</span>
                {campaign.status === "pending" && (
                  <>
                    <button
                      className="btn btn-success btn-sm text-xs font-bold"
                      disabled={updatingId === campaign.id}
                      onClick={() => handleStatusChange(campaign.id, "recruiting")}
                    >
                      Approve → Recruiting
                    </button>
                    <button
                      className="btn btn-error btn-sm text-xs font-bold"
                      disabled={updatingId === campaign.id}
                      onClick={() => handleStatusChange(campaign.id, "cancelled")}
                    >
                      Reject
                    </button>
                  </>
                )}
                {campaign.status === "funded" && (
                  <button
                    className="btn btn-success btn-sm text-xs font-bold"
                    disabled={updatingId === campaign.id}
                    onClick={() => handleStatusChange(campaign.id, "recruiting")}
                  >
                    Approve → Recruiting
                  </button>
                )}
                {["recruiting", "in_progress", "verification"].includes(campaign.status) && (
                  <button
                    className="btn btn-warning btn-sm text-xs font-bold"
                    disabled={updatingId === campaign.id}
                    onClick={() => handleStatusChange(campaign.id, "cancelled")}
                  >
                    Suspend Campaign
                  </button>
                )}
                {campaign.status === "cancelled" && (
                  <button
                    className="btn btn-primary btn-sm text-xs font-bold"
                    disabled={updatingId === campaign.id}
                    onClick={() => handleStatusChange(campaign.id, "pending")}
                  >
                    Re-open as Pending
                  </button>
                )}
                {updatingId === campaign.id && (
                  <span className="loading loading-spinner loading-xs text-primary" />
                )}
                <span className="text-[10px] text-base-content/30 font-mono ml-auto hidden sm:inline">
                  {campaign.id}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
