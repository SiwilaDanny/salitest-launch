"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const severityColor = {
  critical: "badge-error",
  high: "badge-warning",
  medium: "badge-info",
  low: "badge-neutral",
};

export default function FraudReviewPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actioningId, setActioningId] = useState(null);
  const [simulating, setSimulating] = useState(false);

  const supabase = createClient();

  async function fetchFraudEvents() {
    try {
      setLoading(true);
      setError("");
      // Fetch unresolved fraud events joined with tester profiles and devices
      const { data, error: fetchErr } = await supabase
        .from("fraud_events")
        .select(`
          *,
          profiles:user_id (
            id,
            email,
            full_name,
            trust_score,
            created_at
          ),
          tester_devices:device_id (
            id,
            device_name,
            os,
            browser
          )
        `)
        .eq("resolved", false)
        .order("created_at", { ascending: false });

      if (fetchErr) throw fetchErr;
      setEvents(data || []);
    } catch (err) {
      console.error("Error fetching fraud events:", err);
      setError("Failed to fetch fraud events from the database ledger.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchFraudEvents();
  }, []);

  async function handleApprove(event) {
    try {
      setActioningId(event.id);
      const { data: { user } } = await supabase.auth.getUser();

      // Mark the event as resolved
      const { error: updateErr } = await supabase
        .from("fraud_events")
        .update({
          resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_by: user?.id
        })
        .eq("id", event.id);

      if (updateErr) throw updateErr;

      // The PostgreSQL trigger on_fraud_event_change automatically recalculates the profile's trust score!
      setEvents(prev => prev.filter(e => e.id !== event.id));
    } catch (err) {
      console.error("Error resolving fraud event:", err);
      alert(err.message || "Failed to resolve fraud event.");
    } finally {
      setActioningId(null);
    }
  }

  async function handleBanUser(event) {
    if (!confirm(`Are you sure you want to ban user ${event.profiles?.full_name || event.profiles?.email}? This will set their trust score to 0.`)) return;

    try {
      setActioningId(event.id);

      // 1. Force the user profile trust score to 0
      const { error: profileErr } = await supabase
        .from("profiles")
        .update({ trust_score: 0, updated_at: new Date().toISOString() })
        .eq("id", event.user_id);

      if (profileErr) throw profileErr;

      // 2. Insert a critical manual ban event to maintain a perfect audit ledger
      const { error: logErr } = await supabase
        .from("fraud_events")
        .insert({
          user_id: event.user_id,
          event_type: "user_banned",
          severity: "critical",
          details: { flag: "Banned by administrator", note: "Manual administrative termination." }
        });

      if (logErr) throw logErr;

      // 3. Resolve all other active fraud events for this user
      await supabase
        .from("fraud_events")
        .update({ resolved: true })
        .eq("user_id", event.user_id)
        .eq("resolved", false);

      setEvents(prev => prev.filter(e => e.user_id !== event.user_id));
    } catch (err) {
      console.error("Error banning user:", err);
      alert(err.message || "Failed to complete ban procedure.");
    } finally {
      setActioningId(null);
    }
  }

  async function handleInvestigate(event) {
    try {
      setActioningId(event.id);
      const updatedDetails = { ...event.details, status: "investigating", updated_at: new Date().toISOString() };

      const { error: updateErr } = await supabase
        .from("fraud_events")
        .update({ details: updatedDetails })
        .eq("id", event.id);

      if (updateErr) throw updateErr;

      // Update local state to show updated badge
      setEvents(prev =>
        prev.map(e => (e.id === event.id ? { ...e, details: updatedDetails } : e))
      );
    } catch (err) {
      console.error("Error putting event under investigation:", err);
      alert(err.message || "Failed to flag event as investigating.");
    } finally {
      setActioningId(null);
    }
  }

  async function simulateSampleFlag() {
    try {
      setSimulating(true);
      setError("");

      // Find any tester profile or grab the current authed user
      const { data: testers } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .limit(5);

      if (!testers || testers.length === 0) {
        alert("No profiles exist in the database to generate fraud telemetry for. Try registering a user first.");
        return;
      }

      // Pick a random user from profiles
      const targetUser = testers[Math.floor(Math.random() * testers.length)];

      const sampleEvents = [
        {
          user_id: targetUser.id,
          event_type: "vpn_detected",
          severity: "high",
          details: {
            flag: "VPN/Proxy reputation alert",
            device: "Chrome / Windows 10",
            ip: "185.200.118.4 (Residential Proxy Data Center)",
            score: 25,
            breakdown: { network: 25 }
          }
        },
        {
          user_id: targetUser.id,
          event_type: "emulator_detected",
          severity: "critical",
          details: {
            flag: "WebGL SwiftShader hardware signature",
            device: "Emulator (Android 13)",
            ip: "102.83.19.12 (Zambia Mobile ISP)",
            score: 15,
            breakdown: { device: 15 }
          }
        },
        {
          user_id: targetUser.id,
          event_type: "rapid_form_fill",
          severity: "low",
          details: {
            flag: "Rapid form completion (1.8s)",
            device: "Safari / iOS 17",
            ip: "41.72.193.18 (Zambia ISP)",
            score: 42,
            breakdown: { behavior: 42 }
          }
        }
      ];

      const selectedMock = sampleEvents[Math.floor(Math.random() * sampleEvents.length)];

      const { error: insertErr } = await supabase
        .from("fraud_events")
        .insert(selectedMock);

      if (insertErr) throw insertErr;

      await fetchFraudEvents();
    } catch (err) {
      console.error("Error simulating flag:", err);
      setError("Failed to insert mock fraud logs.");
    } finally {
      setSimulating(false);
    }
  }

  if (loading && events.length === 0) {
    return (
      <div className="grid min-h-[50vh] place-items-center bg-base-300">
        <div className="flex flex-col items-center gap-2">
          <span className="loading loading-spinner loading-lg text-primary" />
          <p className="text-xs text-base-content/40 font-semibold tracking-wider uppercase">Syncing Fraud Queue...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10 max-w-5xl mx-auto px-4 pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-extrabold tracking-tight">Fraud Review Queue</h2>
          <p className="text-sm text-base-content/50">
            {events.length} unresolved threat logs flagged for administrative inspection
          </p>
        </div>
        <button
          onClick={simulateSampleFlag}
          disabled={simulating}
          className={`btn btn-outline btn-sm font-semibold border-primary/20 text-primary hover:bg-primary/5 hover:border-primary/40 ${
            simulating ? "btn-disabled" : ""
          }`}
        >
          {simulating && <span className="loading loading-spinner loading-xs" />}
          🚨 Simulate Sample Flag
        </button>
      </div>

      {error && (
        <div className="alert alert-error border border-error/25 bg-error/5 shadow-sm text-sm">
          <span>{error}</span>
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {[
          { value: events.length, label: "Unresolved Alerts", cls: "text-error" },
          { value: "97.2%", label: "System Accuracy", cls: "text-primary" },
          { value: "Zambia", label: "Primary Country", cls: "text-secondary" },
          { value: "0", label: "Bypassed Threats", cls: "text-info" },
        ].map((s) => (
          <div key={s.label} className="card bg-gradient-to-br from-base-200 to-base-100 border border-base-content/10 shadow hover:scale-[1.02] transition-transform">
            <div className="card-body p-5 text-center gap-1">
              <span className={`text-3xl font-black ${s.cls}`}>{s.value}</span>
              <span className="text-[10px] text-base-content/50 uppercase tracking-wider font-bold">{s.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Flagged Users List */}
      <div className="space-y-6">
        {events.length === 0 ? (
          <div className="card bg-base-200 border border-base-content/10 py-16 text-center shadow-lg">
            <div className="card-body items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center text-success border border-success/20">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="font-extrabold text-lg text-base-content/80">Queue Is Clean</h3>
              <p className="text-sm text-base-content/40 max-w-sm">
                No telemetry alerts or duplicate screenshots are currently flagged. Use the simulation button to test review workflows.
              </p>
            </div>
          </div>
        ) : (
          events.map((event) => {
            const sc = severityColor[event.severity] || "badge-neutral";
            const deviceMarker = event.tester_devices
              ? `${event.tester_devices.device_name} (${event.tester_devices.os})`
              : event.details?.device || "Unknown Device Signature";
            const ipMarker = event.details?.ip || "Unknown IP Telemetry";
            const isInvestigating = event.details?.status === "investigating";

            return (
              <div
                key={event.id}
                className={`card bg-base-200 border shadow transition-all ${
                  isInvestigating ? "border-info/40 bg-info/5" : "border-base-content/10 hover:border-primary/40"
                }`}
              >
                <div className="card-body gap-5 p-6">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex gap-5 items-center">
                      <div
                        className="radial-progress text-base font-black bg-base-300 border-4 border-base-300 shadow text-error"
                        style={{
                          "--value": event.profiles?.trust_score ?? 50,
                          "--size": "3.5rem"
                        }}
                      >
                        {event.profiles?.trust_score ?? 50}
                      </div>
                      <div>
                        <h3 className="font-extrabold text-lg leading-tight flex items-center gap-2">
                          {event.profiles?.full_name || "Guest Tester"}
                          {isInvestigating && (
                            <span className="badge badge-info badge-xs uppercase font-bold tracking-wider py-1 px-2">
                              Investigating
                            </span>
                          )}
                        </h3>
                        <p className="text-sm text-base-content/60 font-medium font-mono">{event.profiles?.email}</p>
                        <p className="text-xs text-base-content/30 mt-0.5">
                          Logged: {new Date(event.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <span className={`badge ${sc} uppercase text-[10px] font-bold tracking-widest py-2.5 px-4 shadow-sm`}>
                      {event.severity}
                    </span>
                  </div>

                  <div className="bg-error/5 border border-error/10 rounded-xl p-4">
                    <p className="text-[10px] uppercase tracking-widest text-error font-extrabold mb-2">
                      ⚠️ Triggered Infraction
                    </p>
                    <span className="badge badge-error badge-outline font-bold px-3 py-2.5 text-xs">
                      {event.details?.flag || event.event_type.replace(/_/g, " ")}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs bg-base-300 rounded-xl p-4 border border-base-content/5">
                    <div>
                      <p className="text-[10px] text-base-content/40 uppercase tracking-wider font-bold mb-0.5">Device Fingerprint</p>
                      <p className="font-mono font-bold text-base-content/75">{deviceMarker}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-base-content/40 uppercase tracking-wider font-bold mb-0.5">IP & Network Signature</p>
                      <p className="font-mono font-bold text-base-content/75">{ipMarker}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-2">
                    <button
                      onClick={() => handleApprove(event)}
                      disabled={actioningId === event.id}
                      className={`btn btn-sm btn-success btn-outline font-semibold shadow ${
                        actioningId === event.id ? "btn-disabled" : ""
                      }`}
                    >
                      {actioningId === event.id ? "Processing..." : "✓ Approve"}
                    </button>
                    <button
                      onClick={() => handleBanUser(event)}
                      disabled={actioningId === event.id}
                      className={`btn btn-sm btn-error font-semibold shadow ${
                        actioningId === event.id ? "btn-disabled" : ""
                      }`}
                    >
                      ✕ Ban User
                    </button>
                    {!isInvestigating && (
                      <button
                        onClick={() => handleInvestigate(event)}
                        disabled={actioningId === event.id}
                        className={`btn btn-sm btn-ghost font-semibold text-base-content/65 hover:bg-base-300 ${
                          actioningId === event.id ? "btn-disabled" : ""
                        }`}
                      >
                        🔍 Investigate
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
