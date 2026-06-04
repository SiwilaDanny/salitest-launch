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

  // 2FA state variables
  const [has2fa, setHas2fa] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [setupSecret, setSetupSecret] = useState("");
  const [setupQrUrl, setSetupQrUrl] = useState("");
  const [setupToken, setSetupToken] = useState("");
  const [setupError, setSetupError] = useState("");
  const [setupLoading, setSetupLoading] = useState(false);

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingCampaignId, setPendingCampaignId] = useState(null);
  const [pendingStatus, setPendingStatus] = useState("");
  const [verificationToken, setVerificationToken] = useState("");
  const [verificationError, setVerificationError] = useState("");

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

      // Check if admin has set up 2FA
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("totp_secret")
          .eq("id", user.id)
          .single();
        setHas2fa(!!profile?.totp_secret);
      }
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

  async function handleStartSetup() {
    setSetupLoading(true);
    setSetupError("");
    try {
      const res = await fetch("/api/admin/2fa/setup");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSetupSecret(data.secret);
      setSetupQrUrl(data.qrCodeUrl);
      setShowSetupModal(true);
    } catch (err) {
      setAlertMsg({ type: "error", text: err.message || "Failed to start 2FA setup" });
    } finally {
      setSetupLoading(false);
    }
  }

  async function handleConfirmSetup() {
    setSetupLoading(true);
    setSetupError("");
    try {
      const res = await fetch("/api/admin/2fa/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: setupSecret, token: setupToken })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setHas2fa(true);
      setShowSetupModal(false);
      setSetupToken("");
      setAlertMsg({ type: "success", text: "Google Authenticator 2FA configured successfully!" });
    } catch (err) {
      setSetupError(err.message || "Failed to verify 2FA code.");
    } finally {
      setSetupLoading(false);
    }
  }

  function triggerStatusChange(campaignId, targetStatus) {
    if (!has2fa) {
      setAlertMsg({ type: "error", text: "Google Authenticator 2FA setup is required to update campaign status." });
      return;
    }
    setPendingCampaignId(campaignId);
    setPendingStatus(targetStatus);
    setVerificationToken("");
    setVerificationError("");
    setShowConfirmModal(true);
  }

  async function handleStatusChangeConfirm() {
    setUpdatingId(pendingCampaignId);
    setVerificationError("");
    try {
      const res = await fetch("/api/admin/campaigns/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId: pendingCampaignId,
          status: pendingStatus,
          token: verificationToken
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setCampaigns(prev =>
        prev.map(c => (c.id === pendingCampaignId ? { ...c, status: pendingStatus } : c))
      );
      setAlertMsg({ type: "success", text: `Campaign status updated to "${pendingStatus}".` });
      setShowConfirmModal(false);
    } catch (err) {
      setVerificationError(err.message || "Failed to update campaign status.");
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

      {!has2fa && !loading && (
        <div className="alert bg-warning/15 border-warning/30 text-warning-content shadow-md flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="space-y-1">
            <h3 className="font-bold text-sm flex items-center gap-1.5">
              🔒 Google Authenticator Required
            </h3>
            <p className="text-xs opacity-80">
              For security, you must link your Google Authenticator app before you can approve or manage campaign statuses.
            </p>
          </div>
          <button 
            className="btn btn-warning btn-sm font-bold shadow-sm"
            onClick={handleStartSetup}
            disabled={setupLoading}
          >
            {setupLoading ? 'Loading...' : 'Configure 2FA'}
          </button>
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
                      onClick={() => triggerStatusChange(campaign.id, "recruiting")}
                    >
                      Approve → Recruiting
                    </button>
                    <button
                      className="btn btn-error btn-sm text-xs font-bold"
                      disabled={updatingId === campaign.id}
                      onClick={() => triggerStatusChange(campaign.id, "cancelled")}
                    >
                      Reject
                    </button>
                  </>
                )}
                {campaign.status === "funded" && (
                  <button
                    className="btn btn-success btn-sm text-xs font-bold"
                    disabled={updatingId === campaign.id}
                    onClick={() => triggerStatusChange(campaign.id, "recruiting")}
                  >
                    Approve → Recruiting
                  </button>
                )}
                {["recruiting", "in_progress", "verification"].includes(campaign.status) && (
                  <button
                    className="btn btn-warning btn-sm text-xs font-bold"
                    disabled={updatingId === campaign.id}
                    onClick={() => triggerStatusChange(campaign.id, "cancelled")}
                  >
                    Suspend Campaign
                  </button>
                )}
                {campaign.status === "cancelled" && (
                  <button
                    className="btn btn-primary btn-sm text-xs font-bold"
                    disabled={updatingId === campaign.id}
                    onClick={() => triggerStatusChange(campaign.id, "pending")}
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

      {/* Setup 2FA Modal */}
      {showSetupModal && (
        <div className="modal modal-open">
          <div className="modal-box bg-base-200 border border-base-content/10 shadow-xl max-w-md">
            <h3 className="font-extrabold text-lg flex items-center gap-2">
              🔑 Link Google Authenticator
            </h3>
            <p className="text-xs text-base-content/50 mt-1">
              Scan the QR code below or enter the secret key manually into your Google Authenticator/2FA app.
            </p>

            <div className="flex flex-col items-center justify-center my-6 gap-4">
              {setupQrUrl && (
                <div className="p-3 bg-white rounded-lg shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={setupQrUrl} alt="2FA QR Code" className="w-44 h-44" />
                </div>
              )}
              <div className="w-full text-center space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-base-content/40">Manual Entry Secret Key</p>
                <code className="text-xs bg-base-300 px-3 py-1.5 rounded-lg select-all font-mono font-bold text-primary block w-fit mx-auto">
                  {setupSecret}
                </code>
              </div>
            </div>

            <div className="form-control w-full space-y-2">
              <label className="label py-0">
                <span className="label-text text-xs font-bold uppercase tracking-wider text-base-content/50">Verification Code</span>
              </label>
              <input
                type="text"
                maxLength="6"
                placeholder="e.g. 123456"
                className="input input-bordered w-full font-mono text-center tracking-widest text-lg font-bold bg-base-300"
                value={setupToken}
                onChange={(e) => setSetupToken(e.target.value.replace(/\D/g, ''))}
              />
              {setupError && (
                <p className="text-xs text-error font-bold">{setupError}</p>
              )}
            </div>

            <div className="modal-action">
              <button 
                className="btn btn-ghost font-bold text-xs" 
                onClick={() => setShowSetupModal(false)}
                disabled={setupLoading}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary font-bold text-xs shadow-md"
                onClick={handleConfirmSetup}
                disabled={setupLoading || setupToken.length !== 6}
              >
                {setupLoading ? 'Verifying...' : 'Verify & Enable'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Action 2FA Modal */}
      {showConfirmModal && (
        <div className="modal modal-open">
          <div className="modal-box bg-base-200 border border-base-content/10 shadow-xl max-w-sm">
            <h3 className="font-extrabold text-lg flex items-center gap-2">
              🔒 Admin 2FA Verification
            </h3>
            <p className="text-xs text-base-content/60 mt-1">
              Enter the 6-digit verification code from your Google Authenticator app to authorize this action.
            </p>

            <div className="form-control w-full space-y-2 mt-5">
              <label className="label py-0">
                <span className="label-text text-xs font-bold uppercase tracking-wider text-base-content/50">Authenticator Code</span>
              </label>
              <input
                type="text"
                maxLength="6"
                placeholder="000000"
                className="input input-bordered w-full font-mono text-center tracking-widest text-lg font-bold bg-base-300"
                value={verificationToken}
                onChange={(e) => setVerificationToken(e.target.value.replace(/\D/g, ''))}
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && verificationToken.length === 6 && handleStatusChangeConfirm()}
              />
              {verificationError && (
                <p className="text-xs text-error font-bold">{verificationError}</p>
              )}
            </div>

            <div className="modal-action">
              <button 
                className="btn btn-ghost font-bold text-xs" 
                onClick={() => setShowConfirmModal(false)}
                disabled={updatingId !== null}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary font-bold text-xs shadow-md"
                onClick={handleStatusChangeConfirm}
                disabled={updatingId !== null || verificationToken.length !== 6}
              >
                {updatingId !== null ? 'Verifying...' : 'Confirm Action'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
