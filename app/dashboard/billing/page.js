"use client";

const plans = [
  { id: "starter", name: "Starter (Basic)", price: "15% fee", features: ["No upfront subscription", "15% platform fee on funding", "Min. $1.50 reward / tester", "Closed testing tools"] },
  { id: "pro", name: "Pro", price: 79, features: ["30 verified testers", "14-day testing", "Advanced fraud prevention", "Priority matching", "Real-time analytics", "Priority support"] },
  { id: "enterprise", name: "Enterprise", price: null, features: ["Unlimited testers", "Custom duration", "Dedicated fraud review", "Account manager", "API access"] },
];

const history = [
  { id: "inv1", desc: "Starter — FitTrack Pro (15% Fee)", date: "2026-05-01", amount: 5.40, status: "paid" },
  { id: "inv2", desc: "Pro — BudgetBuddy", date: "2026-04-15", amount: 79.00, status: "paid" },
  { id: "inv3", desc: "Starter — MealPrep AI (15% Fee)", date: "2026-04-01", amount: 5.40, status: "paid" },
];

export default function BillingPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold">Billing & Plans</h2>
        <p className="text-sm text-base-content/40">Manage your subscription and payment history</p>
      </div>

      {/* Current Plan */}
      <div className="card bg-base-200 border border-primary/20">
        <div className="card-body flex-row flex-wrap justify-between items-center gap-4">
          <div>
            <span className="badge badge-primary badge-sm mb-1">Current Plan</span>
            <h3 className="text-2xl font-extrabold">Starter (Basic)</h3>
            <p className="text-sm text-base-content/40 mt-0.5">Pay-as-you-go · 15% platform fee on campaign budget</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-base-content/30 mb-2">Next billing: —</p>
            <button className="btn btn-outline btn-sm">Manage Payment Method</button>
          </div>
        </div>
      </div>

      {/* Plans */}
      <div>
        <h3 className="font-bold mb-4">Available Plans</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {plans.map((plan) => (
            <div key={plan.id} className={`card bg-base-200 border ${plan.id === "starter" ? "border-primary/30" : "border-base-content/5"}`}>
              <div className="card-body gap-3">
                {plan.id === "starter" && <span className="badge badge-primary badge-sm w-fit">Current</span>}
                <h3 className="font-bold text-lg">{plan.name}</h3>
                <div className="text-3xl font-extrabold">
                  {plan.id === "starter" ? "15% fee" : plan.price ? `$${plan.price}` : "Custom"}
                  {plan.price && plan.id !== "starter" && <span className="text-sm font-normal text-base-content/30 ml-1">/campaign</span>}
                </div>
                <ul className="space-y-1.5 my-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex gap-2 text-sm text-base-content/50">
                      <span className="text-success text-xs mt-0.5">✓</span> {f}
                    </li>
                  ))}
                </ul>
                <button className={`btn btn-block btn-sm ${plan.id === "starter" ? "btn-disabled" : "btn-primary"}`} disabled={plan.id === "starter"}>
                  {plan.id === "starter" ? "Current Plan" : plan.id === "enterprise" ? "Contact Sales" : "Upgrade"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Payment History */}
      <div>
        <h3 className="font-bold mb-4">Payment History</h3>
        <div className="overflow-x-auto rounded-lg border border-base-content/5">
          <table className="table table-sm">
            <thead><tr className="bg-base-200"><th>Description</th><th>Date</th><th>Amount</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {history.map((inv) => (
                <tr key={inv.id} className="hover">
                  <td className="font-medium">{inv.desc}</td>
                  <td className="text-base-content/40">{inv.date}</td>
                  <td className="font-mono font-semibold">${inv.amount}</td>
                  <td><span className="badge badge-success badge-sm">Paid</span></td>
                  <td><button className="link link-primary text-sm">Download</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
