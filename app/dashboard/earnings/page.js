"use client";

const transactions = [
  { id: "t1", app: "MealPrep AI", amount: 3.00, status: "paid", date: "2026-05-20", days: 14 },
  { id: "t2", app: "TaskFlow", amount: 5.00, status: "paid", date: "2026-05-10", days: 14 },
  { id: "t3", app: "FitTrack Pro", amount: 3.00, status: "pending", date: "—", days: 11 },
  { id: "t4", app: "RideShare Lite", amount: 6.00, status: "pending", date: "—", days: 7 },
];

const statusMap = {
  paid: { cls: "badge-success", label: "Paid" },
  pending: { cls: "badge-warning", label: "Pending" },
};

export default function EarningsPage() {
  const totalEarned = transactions.filter(t => t.status === "paid").reduce((s, t) => s + t.amount, 0);
  const totalPending = transactions.filter(t => t.status === "pending").reduce((s, t) => s + t.amount, 0);

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: "var(--space-xl)" }}>
        <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700 }}>Earnings & Payouts</h2>
        <p style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>Track your testing rewards</p>
      </div>

      {/* Balance cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--space-lg)", marginBottom: "var(--space-2xl)" }}>
        <div className="glass-card stat-card">
          <div className="stat-value">${totalEarned.toFixed(2)}</div>
          <div className="stat-label">Total Earned</div>
        </div>
        <div className="glass-card stat-card">
          <div className="stat-value" style={{ background: "var(--gradient-success)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
            ${totalPending.toFixed(2)}
          </div>
          <div className="stat-label">Pending Payout</div>
        </div>
        <div className="glass-card stat-card">
          <div className="stat-value">4</div>
          <div className="stat-label">Campaigns Completed</div>
        </div>
      </div>

      {/* Payout CTA */}
      <div className="glass-card" style={{ padding: "var(--space-xl)", marginBottom: "var(--space-xl)", display: "flex", alignItems: "center", justifyContent: "space-between", border: "1px solid rgba(0,184,148,0.2)", flexWrap: "wrap", gap: "var(--space-md)" }}>
        <div>
          <h3 style={{ fontWeight: 700, marginBottom: 4 }}>Ready to Cash Out?</h3>
          <p style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>
            ${totalEarned.toFixed(2)} available — minimum payout is $10.00 via Stripe
          </p>
        </div>
        <button className="btn btn-primary" disabled={totalEarned < 10}>
          💸 Request Payout
        </button>
      </div>

      {/* Transaction history */}
      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>App</th>
              <th>Days Active</th>
              <th>Amount</th>
              <th>Date Paid</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => {
              const s = statusMap[t.status];
              return (
                <tr key={t.id}>
                  <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>{t.app}</td>
                  <td>{t.days}/14 days</td>
                  <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--brand-success)" }}>
                    ${t.amount.toFixed(2)}
                  </td>
                  <td>{t.date}</td>
                  <td><span className={`badge ${s.cls}`}>{s.label}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
