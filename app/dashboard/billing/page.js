"use client";

const plans = [
  { id: "starter", name: "Starter", price: 29, testers: 12, features: ["12 verified testers", "14-day testing", "Basic fraud protection", "Email support"] },
  { id: "pro", name: "Pro", price: 79, testers: 30, features: ["30 verified testers", "14-day testing", "Advanced fraud prevention", "Priority matching", "Real-time analytics", "Priority support"] },
  { id: "enterprise", name: "Enterprise", price: null, testers: null, features: ["Unlimited testers", "Custom duration", "Dedicated fraud review", "Account manager", "API access"] },
];

const history = [
  { id: "inv1", desc: "Starter Campaign — FitTrack Pro", date: "2026-05-01", amount: 29, status: "paid" },
  { id: "inv2", desc: "Pro Campaign — BudgetBuddy", date: "2026-04-15", amount: 79, status: "paid" },
  { id: "inv3", desc: "Starter Campaign — MealPrep AI", date: "2026-04-01", amount: 29, status: "paid" },
];

export default function BillingPage() {
  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: "var(--space-xl)" }}>
        <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700 }}>Billing & Plans</h2>
        <p style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>Manage your subscription and payment history</p>
      </div>

      {/* Current Plan */}
      <div className="glass-card" style={{ padding: "var(--space-xl)", marginBottom: "var(--space-2xl)", border: "1px solid rgba(108,92,231,0.3)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--space-md)" }}>
        <div>
          <span className="badge badge-primary" style={{ marginBottom: "var(--space-sm)" }}>Current Plan</span>
          <h3 style={{ fontSize: "var(--text-2xl)", fontWeight: 800 }}>Starter</h3>
          <p style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)", marginTop: 4 }}>$29 per campaign · 12 verified testers</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)", marginBottom: "var(--space-sm)" }}>Next billing: —</div>
          <button className="btn btn-secondary">Manage Payment Method</button>
        </div>
      </div>

      {/* Plan Selection */}
      <h3 style={{ fontWeight: 700, marginBottom: "var(--space-lg)" }}>Available Plans</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "var(--space-lg)", marginBottom: "var(--space-2xl)" }}>
        {plans.map((plan) => (
          <div key={plan.id} className="glass-card" style={{ padding: "var(--space-xl)", border: plan.id === "starter" ? "1px solid rgba(108,92,231,0.4)" : undefined }}>
            {plan.id === "starter" && <div className="badge badge-primary" style={{ marginBottom: "var(--space-sm)" }}>Current</div>}
            <h3 style={{ fontWeight: 700, fontSize: "var(--text-lg)" }}>{plan.name}</h3>
            <div style={{ margin: "var(--space-md) 0", fontSize: "var(--text-3xl)", fontWeight: 800 }}>
              {plan.price ? `$${plan.price}` : "Custom"}
              {plan.price && <span style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", fontWeight: 400 }}> /campaign</span>}
            </div>
            <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "var(--space-sm)", marginBottom: "var(--space-xl)" }}>
              {plan.features.map((f) => (
                <li key={f} style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", display: "flex", gap: 8 }}>
                  <span style={{ color: "var(--brand-success)" }}>✓</span> {f}
                </li>
              ))}
            </ul>
            <button className={`btn ${plan.id === "starter" ? "btn-ghost" : "btn-primary"}`} style={{ width: "100%" }} disabled={plan.id === "starter"}>
              {plan.id === "starter" ? "Current Plan" : plan.id === "enterprise" ? "Contact Sales" : "Upgrade"}
            </button>
          </div>
        ))}
      </div>

      {/* Invoice History */}
      <h3 style={{ fontWeight: 700, marginBottom: "var(--space-lg)" }}>Payment History</h3>
      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr><th>Description</th><th>Date</th><th>Amount</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {history.map((inv) => (
              <tr key={inv.id}>
                <td style={{ color: "var(--text-primary)", fontWeight: 500 }}>{inv.desc}</td>
                <td>{inv.date}</td>
                <td style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>${inv.amount}</td>
                <td><span className="badge badge-success">Paid</span></td>
                <td><button className="btn btn-ghost btn-sm" style={{ color: "var(--text-accent)" }}>Download</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
