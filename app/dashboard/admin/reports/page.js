"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AdminReportsPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchReports() {
      try {
        const supabase = createClient();

        const [campaignsRes, payoutsRes, fraudRes, enrollmentsRes, feedbackRes] = await Promise.all([
          supabase.from("campaigns").select("status, budget_total, created_at"),
          supabase.from("transactions").select("amount, status, type, created_at")
            .eq("type", "tester_payout").eq("status", "completed"),
          supabase.from("fraud_events").select("severity, resolved, created_at"),
          supabase.from("enrollments").select("status, created_at"),
          supabase.from("feedback").select("overall_rating, is_genuine, created_at"),
        ]);

        const campaigns = campaignsRes.data || [];
        const payouts = payoutsRes.data || [];
        const fraudEvents = fraudRes.data || [];
        const enrollments = enrollmentsRes.data || [];
        const feedback = feedbackRes.data || [];

        // Monthly calculations (last 30 days)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

        const monthCampaigns = campaigns.filter(c =>
          c.created_at >= thirtyDaysAgo && ["completed", "verification", "in_progress"].includes(c.status)
        );
        const monthPayouts = payouts.filter(p => p.created_at >= thirtyDaysAgo);
        const totalPayoutsThisMonth = monthPayouts.reduce((s, p) => s + parseFloat(p.amount || 0), 0);

        const resolvedFraud = fraudEvents.filter(e => e.resolved);
        const totalFraud = fraudEvents.length;
        const fraudDetectionRate = totalFraud > 0 ? ((resolvedFraud.length / totalFraud) * 100).toFixed(1) : "100.0";

        const completedEnrollments = enrollments.filter(e => e.status === "completed").length;
        const totalEnrollments = enrollments.length;
        const completionRate = totalEnrollments > 0 ? ((completedEnrollments / totalEnrollments) * 100).toFixed(1) : "0";

        const genuineFeedback = feedback.filter(f => f.is_genuine !== false);
        const avgRating = genuineFeedback.length > 0
          ? (genuineFeedback.reduce((s, f) => s + (f.overall_rating || 0), 0) / genuineFeedback.length).toFixed(1)
          : "N/A";

        const totalBudget = campaigns.reduce((s, c) => s + parseFloat(c.budget_total || 0), 0);

        setStats({
          monthCampaigns: monthCampaigns.length,
          fraudDetectionRate,
          totalPayoutsThisMonth,
          completionRate,
          avgRating,
          totalCampaigns: campaigns.length,
          totalEnrollments,
          totalFraudEvents: totalFraud,
          totalBudget,
          totalFeedback: feedback.length,
        });
      } catch (err) {
        console.error("Error fetching reports:", err);
        setStats(null);
      } finally {
        setLoading(false);
      }
    }
    fetchReports();
  }, []);

  if (loading) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <div className="flex flex-col items-center gap-2">
          <span className="loading loading-spinner loading-lg text-primary" />
          <p className="text-xs text-base-content/40 font-semibold tracking-wider uppercase">Computing reports...</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 pb-10">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">Reports</h2>
          <p className="text-sm text-base-content/45">Platform health and operating metrics.</p>
        </div>
        <div className="alert alert-warning shadow-sm">
          <span>Unable to load live reports. Check database connectivity and RLS policies.</span>
        </div>
      </div>
    );
  }

  const metricCards = [
    { name: "Campaign throughput", value: stats.monthCampaigns, detail: "active this month", tone: "text-primary" },
    { name: "Fraud resolution", value: `${stats.fraudDetectionRate}%`, detail: "events resolved", tone: "text-error" },
    { name: "Tester payouts", value: `$${(stats.totalPayoutsThisMonth / 1000).toFixed(1)}k`, detail: "released this month", tone: "text-success" },
    { name: "Tester completion", value: `${stats.completionRate}%`, detail: "enrollment completion rate", tone: "text-accent" },
    { name: "Average rating", value: stats.avgRating, detail: "from genuine feedback", tone: "text-secondary" },
    { name: "Total budget", value: `$${(stats.totalBudget / 1000).toFixed(1)}k`, detail: "across all campaigns", tone: "text-info" },
  ];

  const summaryRows = [
    { label: "Total campaigns created", value: stats.totalCampaigns },
    { label: "Total tester enrollments", value: stats.totalEnrollments },
    { label: "Total fraud events logged", value: stats.totalFraudEvents },
    { label: "Total feedback submissions", value: stats.totalFeedback },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-10">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight">Reports</h2>
        <p className="text-sm text-base-content/45">Live platform health and operating metrics.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {metricCards.map((report) => (
          <div key={report.name} className="rounded-box border border-base-content/10 bg-base-200 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-base-content/40">{report.name}</p>
            <p className={`mt-3 text-3xl font-black ${report.tone}`}>{report.value}</p>
            <p className="mt-1 text-sm text-base-content/45">{report.detail}</p>
          </div>
        ))}
      </div>

      <div className="rounded-box border border-base-content/10 bg-base-200 p-5 shadow-sm">
        <h3 className="font-bold mb-4">Platform Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {summaryRows.map((row) => (
            <div key={row.label}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-base-content/40">{row.label}</p>
              <p className="text-xl font-black text-base-content mt-1">{row.value.toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-box border border-base-content/10 bg-base-200 p-5 shadow-sm">
        <h3 className="font-bold">Data Source</h3>
        <p className="mt-2 text-sm leading-relaxed text-base-content/50">
          All metrics are computed in real-time from the production database. Campaign throughput covers the last 30 days.
          Fraud resolution rate reflects the percentage of all logged fraud events that have been reviewed and resolved by admins.
        </p>
      </div>
    </div>
  );
}
