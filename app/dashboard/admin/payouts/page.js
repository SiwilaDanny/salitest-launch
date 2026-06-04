"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import logger from "@/lib/logger";

export default function AdminPayoutsPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actioningId, setActioningId] = useState(null);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    const loadRequests = async () => {
      try {
        setLoading(true);
        setError("");

        const { data, error: fetchError } = await supabase
          .from("transactions")
          .select(`
            id,
            user_id,
            amount,
            currency,
            payout_phone,
            payout_operator,
            approval_status,
            status,
            created_at,
            profiles(id, full_name, email)
          `)
          .eq("type", "tester_payout")
          .eq("approval_status", "requested")
          .order("created_at", { ascending: false });

        if (fetchError) throw fetchError;
        setRequests(data || []);
      } catch (err) {
        logger.error("Error loading payout requests:", err);
        setError("Unable to load payout requests. Please refresh.");
      } finally {
        setLoading(false);
      }
    };

    loadRequests();
  }, [supabase]);

  async function handleAction(transactionId, action) {
    try {
      setActioningId(transactionId);
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) {
        throw new Error("Authentication failed.");
      }

      const endpoint = action === "approve" ? "/api/payment/lenco/payout/approve" : "/api/payment/lenco/payout/reject";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ transaction_id: transactionId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setRequests((prev) => prev.filter((item) => item.id !== transactionId));
    } catch (err) {
      logger.error("Payout request action failed:", err);
      alert(err.message || "Failed to complete action.");
    } finally {
      setActioningId(null);
    }
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-10">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight">Tester Payout Requests</h2>
        <p className="text-sm text-base-content/45">Approve or reject tester payout requests before funds are sent.</p>
      </div>

      {error && (
        <div className="alert alert-error border border-error/25 bg-error/5 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="grid min-h-[30vh] place-items-center">
          <span className="loading loading-spinner loading-lg text-primary" />
        </div>
      ) : requests.length === 0 ? (
        <div className="card bg-base-200 border border-base-content/10 p-8 text-center">
          <p className="font-semibold text-base-content/70">No payout requests are currently pending approval.</p>
          <p className="text-sm text-base-content/40 mt-2">Testers can request payouts from their Earnings page, and admin approval will then process the transfer.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => {
            const owner = request.profiles?.full_name || request.profiles?.email || "Tester";
            return (
              <div key={request.id} className="card bg-base-200 border border-base-content/10 shadow-sm">
                <div className="card-body p-6 gap-4">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold">{owner}</h3>
                      <p className="text-sm text-base-content/50">{request.profiles?.email}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-black text-success">{request.currency} {Number(request.amount).toFixed(2)}</p>
                      <p className="text-xs text-base-content/40">Requested {new Date(request.created_at).toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-base-content/60">
                    <div>
                      <p className="font-semibold text-base-content/80">Phone</p>
                      <p>{request.payout_phone}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-base-content/80">Operator</p>
                      <p>{request.payout_operator}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-base-content/80">Status</p>
                      <span className="badge badge-sm badge-outline">Pending approval</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleAction(request.id, "approve")}
                      disabled={actioningId === request.id}
                      className="btn btn-sm btn-success"
                    >
                      {actioningId === request.id ? "Processing..." : "Approve"}
                    </button>
                    <button
                      onClick={() => handleAction(request.id, "reject")}
                      disabled={actioningId === request.id}
                      className="btn btn-sm btn-ghost"
                    >
                      {actioningId === request.id ? "Processing..." : "Reject"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
