'use client';

import { useState, useEffect } from 'react';

export default function ExchangeRatePage() {
  const [currentRate, setCurrentRate] = useState(26.0);
  const [newRate, setNewRate] = useState('26.00');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [rateHistory, setRateHistory] = useState([]);

  useEffect(() => {
    fetchCurrentRate();
  }, []);

  async function fetchCurrentRate() {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/exchange-rate/set');
      const data = await res.json();

      if (data.success) {
        const rate = data.current_rate || 26.0;
        setCurrentRate(rate);
        setNewRate(rate.toFixed(2));
        setRateHistory(
          (data.history || []).map((entry) => ({
            rate: parseFloat(entry.rate_usd_to_zmw),
            set_by: entry.profiles?.full_name || entry.profiles?.email || 'Admin',
            effective_at: entry.effective_at,
          }))
        );
      } else {
        setError(data.error || 'Failed to fetch current rate');
      }
    } catch (err) {
      setError('Failed to fetch current rate');
    } finally {
      setLoading(false);
    }
  }

  async function handleSetRate(e) {
    e.preventDefault();
    const rateValue = parseFloat(newRate);

    if (!rateValue || rateValue <= 0 || rateValue > 1000) {
      setError('Exchange rate must be between 0.01 and 1000');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const res = await fetch('/api/admin/exchange-rate/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rate_usd_to_zmw: rateValue }),
      });

      const data = await res.json();

      if (data.success) {
        setCurrentRate(rateValue);
        setNewRate(rateValue.toFixed(2));
        setSuccess(`Exchange rate updated to 1 USD = ${rateValue.toFixed(2)} ZMW`);
        setRateHistory((prev) => [
          {
            rate: rateValue,
            set_by: 'You',
            effective_at: new Date().toISOString(),
          },
          ...prev,
        ]);
      } else {
        setError(data.error || 'Failed to set exchange rate');
      }
    } catch (err) {
      setError('Failed to save exchange rate: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <span className="loading loading-spinner loading-lg text-primary" />
        <p className="text-sm text-base-content/60">Loading exchange rate...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Exchange Rate Settings</h1>
        <p className="text-sm text-base-content/60 mt-1">
          Manage the USD to ZMW conversion rate applied to all wallet transactions
        </p>
      </div>

      {error && (
        <div className="alert alert-error shadow-sm flex justify-between">
          <span>{error}</span>
          <button className="btn btn-ghost btn-xs" onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {success && (
        <div className="alert alert-success shadow-sm flex justify-between">
          <span>{success}</span>
          <button className="btn btn-ghost btn-xs" onClick={() => setSuccess(null)}>✕</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Current Rate Display */}
          <div className="card bg-base-200 border border-base-content/5 shadow-md p-6">
            <p className="text-[10px] font-bold uppercase tracking-wider text-base-content/40 mb-1">
              Current Live Rate
            </p>
            <p className="text-4xl font-black tracking-tight">
              1 USD ={' '}
              <span className="text-primary">{currentRate.toFixed(2)}</span>{' '}
              <span className="text-base-content/50 text-2xl">ZMW</span>
            </p>
          </div>

          {/* Set Rate Form */}
          <div className="card bg-base-200 border border-base-content/5 shadow-md p-6">
            <h2 className="text-lg font-bold mb-5">Update Exchange Rate</h2>
            <form onSubmit={handleSetRate} className="space-y-5">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-base-content/50 mb-3">
                  New Rate (USD → ZMW)
                </label>
                <div className="flex items-center gap-3">
                  <span className="text-base font-bold text-base-content/70 whitespace-nowrap">1 USD =</span>
                  <input
                    type="number"
                    value={newRate}
                    onChange={(e) => setNewRate(e.target.value)}
                    step="0.01"
                    min="0.01"
                    max="1000"
                    disabled={saving}
                    className="input input-bordered w-full text-lg font-extrabold bg-base-300"
                  />
                  <span className="text-base font-bold text-base-content/70">ZMW</span>
                </div>
                <p className="text-[10px] text-base-content/40 mt-2">
                  New rate takes effect immediately for all future transactions.
                </p>
              </div>

              <div className="alert alert-warning text-xs font-medium py-3">
                <span>⚠️ <strong>Note:</strong> Rate changes only affect new transactions. Existing completed transactions keep their original conversion rate.</span>
              </div>

              <button
                type="submit"
                disabled={saving || parseFloat(newRate) === currentRate}
                className="btn btn-primary w-full font-bold"
              >
                {saving ? <><span className="loading loading-spinner loading-xs" /> Saving...</> : 'Update Exchange Rate'}
              </button>
            </form>
          </div>
        </div>

        {/* Info Sidebar */}
        <div className="space-y-4">
          <div className="card bg-base-200 border border-base-content/5 shadow-md p-6">
            <h3 className="font-bold text-sm mb-4">💡 How It Works</h3>
            <ul className="text-xs text-base-content/70 space-y-3">
              <li><strong className="text-base-content">Deposits:</strong> USD amounts are converted to ZMW at the current rate upon initiation.</li>
              <li><strong className="text-base-content">Withdrawals:</strong> Calculated in both currencies for transparent display.</li>
              <li><strong className="text-base-content">Wallets:</strong> Show balances in both USD and ZMW simultaneously.</li>
              <li><strong className="text-base-content">Immutable:</strong> Each transaction stores its rate at creation time.</li>
              <li><strong className="text-base-content">Global:</strong> Changes apply platform-wide instantly.</li>
            </ul>
          </div>

          <div className="card bg-base-200 border border-base-content/5 shadow-md p-6">
            <h3 className="font-bold text-sm mb-4">📊 Reference Rates</h3>
            <div className="space-y-2 text-xs">
              {[
                { label: 'Conservative', value: '24.00' },
                { label: 'Market Average', value: '26.00' },
                { label: 'Premium', value: '27.50' },
              ].map(({ label, value }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setNewRate(value)}
                  className="w-full flex justify-between items-center px-3 py-2 rounded-lg bg-base-300 hover:bg-primary/10 hover:text-primary transition-colors group"
                >
                  <span className="text-base-content/60 group-hover:text-primary">{label}</span>
                  <span className="font-mono font-bold text-base-content group-hover:text-primary">{value}</span>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-base-content/40 mt-3">
              Click a reference rate to auto-fill the input field.
            </p>
          </div>
        </div>
      </div>

      {/* Rate History */}
      {rateHistory.length > 0 && (
        <div className="card bg-base-200 border border-base-content/5 shadow-md overflow-hidden">
          <div className="p-4 border-b border-base-content/5">
            <h2 className="text-base font-bold">Recent Rate Changes</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="table table-zebra table-sm w-full">
              <thead>
                <tr className="border-b border-base-content/10">
                  <th className="font-bold text-base-content/60">#</th>
                  <th className="font-bold text-base-content/60">Exchange Rate</th>
                  <th className="font-bold text-base-content/60">Set By</th>
                  <th className="font-bold text-base-content/60">Effective At</th>
                </tr>
              </thead>
              <tbody>
                {rateHistory.slice(0, 10).map((entry, idx) => (
                  <tr key={idx} className="hover border-b border-base-content/5 last:border-none">
                    <td className="text-xs font-mono text-base-content/40">{idx + 1}</td>
                    <td className="font-mono font-bold text-sm text-base-content">
                      1 USD = <span className="text-primary">{entry.rate.toFixed(2)}</span> ZMW
                    </td>
                    <td className="text-xs text-base-content/60">{entry.set_by}</td>
                    <td className="text-xs text-base-content/60">
                      {new Date(entry.effective_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
