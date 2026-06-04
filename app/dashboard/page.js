"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppMark } from "@/app/dashboard/_components/AppMark";
import { createClient } from "@/lib/supabase/client";

const stats = [
  { value: "3", label: "Live campaigns", change: "+1 this week", tone: "text-primary" },
  { value: "28", label: "Approved testers", change: "12 joined this week", tone: "text-secondary" },
  { value: "86%", label: "Completion rate", change: "+5% from last run", tone: "text-success" },
  { value: "$127", label: "Spend this cycle", change: "$49 committed", tone: "text-warning" },
];

const campaigns = [
  { id: 1, app: "FitTrack Pro", platform: "Android", testers: 12, required: 12, day: 11, status: "in_progress", findings: 18, spend: "$36" },
  { id: 2, app: "BudgetBuddy", platform: "iOS", testers: 8, required: 12, day: 3, status: "recruiting", findings: 7, spend: "$40" },
  { id: 3, app: "MealPrep AI", platform: "Android", testers: 12, required: 12, day: 14, status: "completed", findings: 23, spend: "$51" },
];

const recentActivity = [
  { title: "Sarah K. joined FitTrack Pro", detail: "Device verified and consent captured", time: "2h", type: "success" },
  { title: "MealPrep AI feedback batch is ready", detail: "9 notes grouped by onboarding flow", time: "5h", type: "info" },
  { title: "BudgetBuddy needs 4 more testers", detail: "Recruiting is below target for day 3", time: "1d", type: "warning" },
  { title: "FitTrack Pro tester flagged", detail: "Screenshot cadence needs manual review", time: "1d", type: "error" },
];

const attentionItems = [
  { label: "Recruit testers for BudgetBuddy", meta: "4 spots open", cls: "alert-warning" },
  { label: "Review flagged FitTrack session", meta: "1 risk event", cls: "alert-error" },
  { label: "Publish MealPrep final report", meta: "23 findings", cls: "alert-info" },
];

const statusMap = {
  in_progress: { cls: "border-secondary/25 bg-secondary/10 text-secondary", label: "In Progress" },
  recruiting: { cls: "border-warning/25 bg-warning/10 text-warning", label: "Recruiting" },
  completed: { cls: "border-success/25 bg-success/10 text-success", label: "Completed" },
};

export default function DashboardOverview() {
  const router = useRouter();
  const [checkingRole, setCheckingRole] = useState(true);

  useEffect(() => {
    async function redirectByRole() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

        const role = profile?.role || user.user_metadata?.role || "developer";
        if (role === "admin") {
          router.replace("/dashboard/admin");
          return;
        }
        if (role === "tester") {
          router.replace("/dashboard/browse");
          return;
        }
      } catch (err) {
        console.error("Failed to check dashboard role:", err);
      } finally {
        setCheckingRole(false);
      }
    }

    redirectByRole();
  }, [router]);

  if (checkingRole) {
    return (
      <div className="flex min-h-[45vh] items-center justify-center">
        <span className="loading loading-spinner loading-md text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10">
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.45fr_0.75fr]">
        <div className="rounded-box border border-base-content/10 bg-base-200 p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="badge badge-primary badge-outline mb-3">Developer workspace</div>
              <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Campaign health</h2>
              <p className="mt-2 max-w-2xl text-sm text-base-content/55">
                Track tester recruitment, fraud checks, feedback volume, and spend across your active app launches.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/dashboard/campaigns/new" className="btn btn-primary btn-sm">+ New campaign</Link>
              <Link href="/dashboard/apps" className="btn btn-outline btn-sm">Manage apps</Link>
            </div>
          </div>

          <div className="stats stats-vertical mt-5 w-full bg-base-100 shadow-sm sm:stats-horizontal">
            {stats.map((s) => (
              <div key={s.label} className="stat">
                <div className="stat-title text-xs uppercase tracking-wide">{s.label}</div>
                <div className={`stat-value text-3xl ${s.tone}`}>{s.value}</div>
                <div className="stat-desc">{s.change}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-box border border-base-content/10 bg-base-200 p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-bold">Needs attention</h3>
              <p className="mt-1 text-sm text-base-content/45">The next actions that unblock launches.</p>
            </div>
            <div
              className="radial-progress text-warning"
              style={{ "--value": 72, "--size": "4.25rem", "--thickness": "0.45rem" }}
              role="progressbar"
            >
              72%
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {attentionItems.map((item) => (
              <div key={item.label} className={`alert ${item.cls} py-3`}>
                <div>
                  <p className="text-sm font-semibold">{item.label}</p>
                  <p className="text-xs opacity-70">{item.meta}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.45fr_0.75fr]">
        <div className="rounded-box border border-base-content/10 bg-base-200 shadow-sm">
          <div className="flex flex-col gap-3 border-b border-base-content/10 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-bold">Campaigns in motion</h3>
              <p className="text-sm text-base-content/45">Live recruitment and testing progress.</p>
            </div>
            <Link href="/dashboard/campaigns" className="btn btn-ghost btn-sm text-primary">View all &gt;</Link>
          </div>

          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>App</th>
                  <th>Platform</th>
                  <th>Testers</th>
                  <th>Window</th>
                  <th>Findings</th>
                  <th>Spend</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => {
                  const sb = statusMap[c.status] || { cls: "badge-info", label: c.status };
                  const progress = Math.round((c.day / 14) * 100);

                  return (
                    <tr key={c.id} className="hover">
                      <td>
                        <div className="flex items-center gap-3">
                          <AppMark name={c.app} size="sm" />
                          <div>
                            <p className="font-semibold">{c.app}</p>
                            <p className="text-xs text-base-content/40">14 day playtest</p>
                          </div>
                        </div>
                      </td>
                      <td><span className="badge badge-ghost">{c.platform}</span></td>
                      <td className="font-mono text-sm">{c.testers}/{c.required}</td>
                      <td className="min-w-40">
                        <div className="flex items-center gap-2">
                          <progress className="progress progress-primary h-1.5 w-24" value={progress} max="100" />
                          <span className="text-xs text-base-content/45">Day {c.day}</span>
                        </div>
                      </td>
                      <td className="font-mono text-sm">{c.findings}</td>
                      <td className="font-mono text-sm">{c.spend}</td>
                      <td>
                        <span className={`inline-flex h-6 min-w-24 items-center justify-center rounded-full border px-3 text-[11px] font-bold leading-none ${sb.cls}`}>
                          {sb.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-box border border-base-content/10 bg-base-200 p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-bold">Activity</h3>
              <p className="text-sm text-base-content/45">Latest signal from testers.</p>
            </div>
            <span className="badge badge-outline">Live</span>
          </div>

          <ul className="timeline timeline-vertical timeline-compact">
            {recentActivity.map((a, i) => (
              <li key={a.title}>
                {i > 0 && <hr className="bg-base-content/10" />}
                <div className={`timeline-middle h-3 w-3 rounded-full ${
                  a.type === "success" ? "bg-success" : a.type === "warning" ? "bg-warning" : a.type === "error" ? "bg-error" : "bg-info"
                }`} />
                <div className="timeline-end mb-5">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{a.title}</p>
                    <span className="text-xs text-base-content/35">{a.time}</span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-base-content/45">{a.detail}</p>
                </div>
                {i < recentActivity.length - 1 && <hr className="bg-base-content/10" />}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-box border border-base-content/10 bg-base-200 p-5 shadow-sm">
          <p className="text-sm font-semibold text-base-content/60">Feedback quality</p>
          <div className="mt-4 flex items-end justify-between">
            <span className="text-4xl font-black">48</span>
            <span className="badge badge-success">12 new</span>
          </div>
          <progress className="progress progress-success mt-5 h-2 w-full" value="78" max="100" />
          <p className="mt-3 text-xs text-base-content/45">Most reports include screen evidence and reproducible steps.</p>
        </div>

        <div className="rounded-box border border-base-content/10 bg-base-200 p-5 shadow-sm">
          <p className="text-sm font-semibold text-base-content/60">Fraud review</p>
          <div className="mt-4 flex items-end justify-between">
            <span className="text-4xl font-black">1</span>
            <Link href="/dashboard/admin/fraud" className="btn btn-warning btn-sm">Review</Link>
          </div>
          <progress className="progress progress-warning mt-5 h-2 w-full" value="18" max="100" />
          <p className="mt-3 text-xs text-base-content/45">One tester has irregular screenshot intervals.</p>
        </div>

        <div className="rounded-box border border-base-content/10 bg-base-200 p-5 shadow-sm">
          <p className="text-sm font-semibold text-base-content/60">Payout queue</p>
          <div className="mt-4 flex items-end justify-between">
            <span className="text-4xl font-black">$84</span>
            <Link href="/dashboard/billing" className="btn btn-outline btn-sm">Open</Link>
          </div>
          <progress className="progress progress-secondary mt-5 h-2 w-full" value="62" max="100" />
          <p className="mt-3 text-xs text-base-content/45">Pending payouts release after campaign verification.</p>
        </div>
      </section>
    </div>
  );
}
