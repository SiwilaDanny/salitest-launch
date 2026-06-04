"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function AdminOverviewPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const supabase = createClient();

        // Fetch counts in parallel
        const [profilesRes, campaignsRes, fraudRes, walletTxRes] = await Promise.all([
          supabase.from("profiles").select("role", { count: "exact", head: false }),
          supabase.from("campaigns").select("status", { count: "exact", head: false }),
          supabase.from("fraud_events").select("id", { count: "exact", head: true }).eq("resolved", false),
          supabase.from("wallet_transactions").select("id, amount_usd, status", { count: "exact", head: false }).eq("status", "completed"),
        ]);

        const profiles = profilesRes.data || [];
        const campaigns = campaignsRes.data || [];
        const walletTx = walletTxRes.data || [];

        const devCount = profiles.filter(p => p.role === "developer").length;
        const testerCount = profiles.filter(p => p.role === "tester").length;
        const totalUsers = profiles.length;
        const openFraud = fraudRes.count || 0;
        const activeCampaigns = campaigns.filter(c => ["recruiting", "in_progress", "verification"].includes(c.status)).length;
        const totalVolume = walletTx.reduce((sum, tx) => sum + parseFloat(tx.amount_usd || 0), 0);

        setStats({
          totalUsers,
          devCount,
          testerCount,
          openFraud,
          activeCampaigns,
          totalCampaigns: campaigns.length,
          totalVolume,
        });
      } catch (err) {
        console.error("Error fetching admin stats:", err);
        // Fallback to zeros
        setStats({
          totalUsers: 0, devCount: 0, testerCount: 0,
          openFraud: 0, activeCampaigns: 0, totalCampaigns: 0, totalVolume: 0,
        });
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <div className="flex flex-col items-center gap-2">
          <span className="loading loading-spinner loading-lg text-primary" />
          <p className="text-xs text-base-content/40 font-semibold tracking-wider uppercase">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const statCards = [
    { value: stats.openFraud, label: "Open fraud reviews", tone: "text-error", href: "/dashboard/admin/fraud" },
    { value: stats.devCount, label: "Developers", tone: "text-primary", href: "/dashboard/admin/users" },
    { value: stats.testerCount, label: "Testers", tone: "text-secondary", href: "/dashboard/admin/users" },
    { value: `$${(stats.totalVolume / 1000).toFixed(1)}k`, label: "Wallet volume", tone: "text-success", href: "/dashboard/admin/wallet" },
    { value: stats.activeCampaigns, label: "Active campaigns", tone: "text-accent", href: "/dashboard/admin/campaigns" },
    { value: stats.totalUsers, label: "Total users", tone: "text-info", href: "/dashboard/admin/users" },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight">Admin Overview</h2>
        <p className="text-sm text-base-content/45">Live platform statistics and quick navigation.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {statCards.map((stat) => (
          <Link href={stat.href} key={stat.label} className="group">
            <div className="rounded-box border border-base-content/10 bg-base-200 p-5 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-base-content/40">{stat.label}</p>
              <p className={`mt-3 text-3xl font-black ${stat.tone}`}>{stat.value}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Link href="/dashboard/admin/fraud" className="group">
          <div className="rounded-box border border-base-content/10 bg-base-200 p-5 shadow-sm hover:shadow-md transition-all h-full">
            <h3 className="font-bold group-hover:text-primary transition-colors">Risk Queue</h3>
            <p className="mt-1 text-sm text-base-content/45">Review flagged testers before payouts are released.</p>
            <div className="mt-5 flex items-center justify-between">
              <span className="badge badge-warning font-bold text-xs">{stats.openFraud} Open</span>
              <span className="text-xs font-bold text-primary group-hover:underline">Open fraud review →</span>
            </div>
          </div>
        </Link>

        <Link href="/dashboard/admin/wallet" className="group">
          <div className="rounded-box border border-base-content/10 bg-base-200 p-5 shadow-sm hover:shadow-md transition-all h-full">
            <h3 className="font-bold group-hover:text-primary transition-colors">Wallet Management</h3>
            <p className="mt-1 text-sm text-base-content/45">Approve deposits, manage withdrawals, and set exchange rates.</p>
            <div className="mt-5 flex items-center justify-between">
              <span className="text-xs text-base-content/40">Full ledger access</span>
              <span className="text-xs font-bold text-primary group-hover:underline">Open wallet →</span>
            </div>
          </div>
        </Link>

        <Link href="/dashboard/admin/campaigns" className="group">
          <div className="rounded-box border border-base-content/10 bg-base-200 p-5 shadow-sm hover:shadow-md transition-all h-full">
            <h3 className="font-bold group-hover:text-primary transition-colors">Campaign Review</h3>
            <p className="mt-1 text-sm text-base-content/45">Audit and moderate platform campaigns.</p>
            <div className="mt-5 flex items-center justify-between">
              <span className="badge badge-accent badge-outline font-bold text-xs">{stats.activeCampaigns} Active</span>
              <span className="text-xs font-bold text-primary group-hover:underline">Review campaigns →</span>
            </div>
          </div>
        </Link>
      </div>

      <div className="rounded-box border border-base-content/10 bg-base-200 p-5 shadow-sm">
        <h3 className="font-bold">Role Controls</h3>
        <p className="mt-1 text-sm text-base-content/45">Developer, tester, and admin areas are separated by route guards and middleware.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <span className="badge badge-outline">developer</span>
          <span className="badge badge-outline">tester</span>
          <span className="badge badge-outline">admin</span>
        </div>
      </div>
    </div>
  );
}
