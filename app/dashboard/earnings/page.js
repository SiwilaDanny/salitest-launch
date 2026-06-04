"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const transactions = [
  { id: "t1", app: "MealPrep AI", amount: 3.00, status: "paid", date: "2026-05-20", days: 14 },
  { id: "t2", app: "TaskFlow", amount: 5.00, status: "paid", date: "2026-05-10", days: 14 },
  { id: "t3", app: "FitTrack Pro", amount: 3.00, status: "pending", date: "—", days: 11 },
  { id: "t4", app: "RideShare Lite", amount: 6.00, status: "pending", date: "—", days: 7 },
];

export default function EarningsPage() {
  const [phone, setPhone] = useState("");
  const [operator, setOperator] = useState("mtn");
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [payoutStatus, setPayoutStatus] = useState("idle");
  const [exchangeRate, setExchangeRate] = useState(null);

  useEffect(() => {
    async function loadExchangeRate() {
      try {
        const res = await fetch('/api/wallet/exchange-rate');
        const data = await res.json();
        if (data.success && data.rate) {
          setExchangeRate(data.rate);
        }
      } catch (err) {
        console.error('Failed to fetch exchange rate:', err);
      }
    }
    loadExchangeRate();
  }, []);

  const totalEarned = transactions.filter(t => t.status === "paid").reduce((s, t) => s + t.amount, 0);
  const totalPending = transactions.filter(t => t.status === "pending").reduce((s, t) => s + t.amount, 0);

  async function handlePayoutSubmit(e) {
    e.preventDefault();
    if (!phone) return;
    setPayoutLoading(true);
    setPayoutStatus("loading");

    try {
      const supabase = createClient();
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) {
        throw new Error("Authentication is required to request a payout.");
      }

      const res = await fetch("/api/payment/lenco/payout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ phone, operator, amount: totalEarned }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setPayoutStatus("success");
      setTimeout(() => {
        document.getElementById('payout_modal').close();
        setPayoutStatus("idle");
      }, 2000);
    } catch (err) {
      console.error("Payout request failed:", err);
      setPayoutStatus("error");
    } finally {
      setPayoutLoading(false);
    }
  }

  const formatZmw = (usd) => {
    if (!exchangeRate) return null;
    return `ZK ${(usd * exchangeRate).toFixed(2)}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Earnings & Payouts</h2>
        <p className="text-sm text-base-content/40">Track your testing rewards</p>
      </div>

      {/* Balance cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card bg-base-200 border border-base-content/5">
          <div className="card-body p-5 gap-1">
            <span className="text-3xl font-black text-gradient">${totalEarned.toFixed(2)}</span>
            <span className="text-sm text-base-content/40">Total Earned</span>
            {formatZmw(totalEarned) && (
              <span className="text-xs text-base-content/30 font-mono">{formatZmw(totalEarned)}</span>
            )}
          </div>
        </div>
        <div className="card bg-base-200 border border-base-content/5">
          <div className="card-body p-5 gap-1">
            <span className="text-3xl font-black text-success">${totalPending.toFixed(2)}</span>
            <span className="text-sm text-base-content/40">Pending Payout</span>
            {formatZmw(totalPending) && (
              <span className="text-xs text-base-content/30 font-mono">{formatZmw(totalPending)}</span>
            )}
          </div>
        </div>
        <div className="card bg-base-200 border border-base-content/5">
          <div className="card-body p-5 gap-1">
            <span className="text-3xl font-black text-gradient">4</span>
            <span className="text-sm text-base-content/40">Campaigns Completed</span>
            {exchangeRate && (
              <span className="text-xs text-base-content/30">1 USD = {exchangeRate.toFixed(2)} ZMW</span>
            )}
          </div>
        </div>
      </div>

      {/* Payout CTA */}
      <div className="card bg-base-200 border border-success/15">
        <div className="card-body flex-row flex-wrap justify-between items-center gap-4">
          <div>
            <h3 className="font-bold">Ready to Cash Out?</h3>
            <p className="text-sm text-base-content/40">
              ${totalEarned.toFixed(2)} available{formatZmw(totalEarned) ? ` (≈ ${formatZmw(totalEarned)})` : ''} — withdraw instantly via Mobile Money
            </p>
          </div>
          <button 
            className="btn btn-primary" 
            disabled={totalEarned < 5} 
            onClick={() => document.getElementById('payout_modal').showModal()}
          >
            💸 Request Payout
          </button>
        </div>
      </div>

      {/* Payout Modal */}
      <dialog id="payout_modal" className="modal">
        <div className="modal-box bg-base-200">
          <h3 className="font-bold text-lg">Withdraw Rewards</h3>
          <p className="py-2 text-sm text-base-content/70">Transfer your earnings directly to your mobile wallet.</p>
          {formatZmw(totalEarned) && (
            <p className="text-xs text-base-content/50 font-mono">
              Payout: ${totalEarned.toFixed(2)} USD ≈ {formatZmw(totalEarned)} (1 USD = {exchangeRate.toFixed(2)} ZMW)
            </p>
          )}
          
          {payoutStatus === "success" ? (
            <div className="alert alert-success mt-4">Payout request submitted. Waiting on admin approval.</div>
          ) : (
            <form onSubmit={handlePayoutSubmit} className="space-y-4 mt-2">
              <div className="form-control">
                <label className="label py-1"><span className="label-text text-xs">Operator</span></label>
                <select className="select select-bordered w-full select-sm" value={operator} onChange={(e) => setOperator(e.target.value)}>
                  <option value="mtn">MTN Mobile Money</option>
                  <option value="airtel">Airtel Money</option>
                  <option value="zamtel">Zamtel Kwacha</option>
                </select>
              </div>
              <div className="form-control">
                <label className="label py-1"><span className="label-text text-xs">Mobile Number</span></label>
                <input 
                  type="text" 
                  placeholder="e.g. 096..." 
                  className="input input-bordered w-full input-sm" 
                  value={phone} 
                  onChange={(e) => setPhone(e.target.value)}
                  required 
                />
              </div>
              <div className="modal-action mt-6">
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => document.getElementById('payout_modal').close()}>Cancel</button>
                <button type="submit" className="btn btn-sm btn-primary" disabled={payoutLoading || !phone}>
                  {payoutLoading ? "Processing..." : "Confirm Payout"}
                </button>
              </div>
            </form>
          )}
        </div>
      </dialog>

      {/* Transaction table */}
      <div className="overflow-x-auto rounded-lg border border-base-content/5">
        <table className="table table-sm">
          <thead><tr className="bg-base-200"><th>App</th><th>Days Active</th><th>Amount</th><th>ZMW</th><th>Date Paid</th><th>Status</th></tr></thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.id} className="hover">
                <td className="font-semibold">{t.app}</td>
                <td className="text-base-content/40">{t.days}/14 days</td>
                <td className="font-mono font-bold text-success">${t.amount.toFixed(2)}</td>
                <td className="font-mono text-xs text-base-content/40">{formatZmw(t.amount) || '—'}</td>
                <td className="text-base-content/40">{t.date}</td>
                <td><span className={`badge badge-sm ${t.status === "paid" ? "badge-success" : "badge-warning"}`}>{t.status === "paid" ? "Paid" : "Pending"}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

