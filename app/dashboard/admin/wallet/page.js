'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

// Move StatCard outside of WalletDashboard to fix ESLint component-in-render issues
function StatCard({ title, value, subtitle, href, pending = false }) {
  return (
    <Link href={href} className="block group">
      <div className="card bg-base-200 border border-base-content/5 shadow-md hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5">
        <div className="card-body p-5 gap-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-base-content/50">{title}</p>
          <p className={`text-2xl font-black ${pending ? 'text-error' : 'text-base-content'}`}>
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          {subtitle && <p className="text-[10px] text-base-content/40 mt-1">{subtitle}</p>}
        </div>
      </div>
    </Link>
  );
}

export default function WalletDashboard() {
  const [stats, setStats] = useState({
    pending_deposits: 0,
    pending_withdrawals: 0,
    total_deposits_usd: 0,
    total_withdrawals_usd: 0,
    active_users_with_wallet: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exchangeRate, setExchangeRate] = useState(26.0);

  async function fetchWalletStats() {
    try {
      setLoading(true);
      
      // Fetch pending transactions and exchange rate
      const [depositRes, withdrawalRes, rateRes] = await Promise.all([
        fetch('/api/admin/wallet/transactions?approval_status=requested&type=deposit&limit=1'),
        fetch('/api/admin/wallet/transactions?approval_status=requested&type=withdrawal&limit=1'),
        fetch('/api/admin/exchange-rate/set'),
      ]);

      const depositData = await depositRes.json();
      const withdrawalData = await withdrawalRes.json();
      const rateData = await rateRes.json();

      if (rateData.success) {
        setExchangeRate(rateData.current_rate);
      }

      // Calculate totals from all transactions
      const allTransRes = await fetch('/api/admin/wallet/transactions?limit=1000');
      const allTransData = await allTransRes.json();

      let totalDeposits = 0;
      let totalWithdrawals = 0;
      let walletUsers = new Set();

      allTransData.transactions?.forEach((tx) => {
        walletUsers.add(tx.user_id);
        if (tx.type === 'deposit' && tx.status === 'completed') {
          totalDeposits += tx.amount_usd;
        }
        if (tx.type === 'withdrawal' && tx.status === 'completed') {
          totalWithdrawals += tx.amount_usd;
        }
      });

      setStats({
        pending_deposits: depositData.total || 0,
        pending_withdrawals: withdrawalData.total || 0,
        total_deposits_usd: totalDeposits,
        total_withdrawals_usd: totalWithdrawals,
        active_users_with_wallet: walletUsers.size,
      });

      setError(null);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
      setError('Failed to load wallet statistics');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchWalletStats();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <span className="loading loading-spinner loading-lg text-primary" />
        <p className="text-sm text-base-content/60">Loading wallet dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Wallet Management</h1>
        <p className="text-sm text-base-content/60 mt-1">
          Monitor user account balances, deposits, and withdrawals
        </p>
      </div>

      {error && (
        <div className="alert alert-error shadow-sm">
          <span>{error}</span>
        </div>
      )}

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Pending Deposits"
          value={stats.pending_deposits}
          href="/dashboard/admin/wallet/approvals?type=deposit"
          pending={stats.pending_deposits > 0}
          subtitle={stats.pending_deposits > 0 ? 'Needs approval' : 'All clear'}
        />
        <StatCard
          title="Pending Withdrawals"
          value={stats.pending_withdrawals}
          href="/dashboard/admin/wallet/approvals?type=withdrawal"
          pending={stats.pending_withdrawals > 0}
          subtitle={stats.pending_withdrawals > 0 ? 'Needs action' : 'All clear'}
        />
        <StatCard
          title="Deposits Processed"
          value={`$${stats.total_deposits_usd.toFixed(2)}`}
          href="/dashboard/admin/wallet/transactions?status=completed&type=deposit"
          subtitle="Total USD"
        />
        <StatCard
          title="Withdrawals Processed"
          value={`$${stats.total_withdrawals_usd.toFixed(2)}`}
          href="/dashboard/admin/wallet/transactions?status=completed&type=withdrawal"
          subtitle="Total USD"
        />
        <StatCard
          title="Active Wallet Users"
          value={stats.active_users_with_wallet}
          href="/dashboard/admin/wallet/transactions"
          subtitle="Unique profiles"
        />
      </div>

      {/* Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link href="/dashboard/admin/wallet/approvals" className="group">
          <div className="card bg-base-200 border border-base-content/5 shadow-md hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 p-6 flex flex-col justify-between h-full">
            <div>
              <h2 className="text-lg font-bold text-base-content group-hover:text-primary transition-colors">
                Approve Deposits &amp; Withdrawals
              </h2>
              <p className="text-xs text-base-content/60 mt-1">
                Review pending fund transfers, verify proof of payments, and approve or reject requests
              </p>
            </div>
            <div className="mt-6 flex items-center justify-between">
              <span className="badge badge-warning font-semibold text-xs py-2 px-3">
                {stats.pending_deposits + stats.pending_withdrawals} Pending
              </span>
              <span className="text-xs font-bold text-primary group-hover:underline">Review requests →</span>
            </div>
          </div>
        </Link>

        <Link href="/dashboard/admin/wallet/audit-logs" className="group">
          <div className="card bg-base-200 border border-base-content/5 shadow-md hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 p-6 flex flex-col justify-between h-full">
            <div>
              <h2 className="text-lg font-bold text-base-content group-hover:text-primary transition-colors">
                View Audit Logs
              </h2>
              <p className="text-xs text-base-content/60 mt-1">
                Check immutable transaction approval history, logs, and administrative actions
              </p>
            </div>
            <div className="mt-6 flex items-center justify-between">
              <span className="text-xs text-base-content/40">Secure approval ledger</span>
              <span className="text-xs font-bold text-primary group-hover:underline">View logs →</span>
            </div>
          </div>
        </Link>

        <Link href="/dashboard/admin/wallet/transactions" className="group">
          <div className="card bg-base-200 border border-base-content/5 shadow-md hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 p-6 flex flex-col justify-between h-full">
            <div>
              <h2 className="text-lg font-bold text-base-content group-hover:text-primary transition-colors">
                All Transactions
              </h2>
              <p className="text-xs text-base-content/60 mt-1">
                Search, filter, and audit all wallet transactions by user, type, status, or date
              </p>
            </div>
            <div className="mt-6 flex items-center justify-between">
              <span className="text-xs text-base-content/40">Full ledger history</span>
              <span className="text-xs font-bold text-primary group-hover:underline">View all →</span>
            </div>
          </div>
        </Link>

        <Link href="/dashboard/admin/wallet/exchange-rate" className="group">
          <div className="card bg-base-200 border border-base-content/5 shadow-md hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 p-6 flex flex-col justify-between h-full">
            <div>
              <h2 className="text-lg font-bold text-base-content group-hover:text-primary transition-colors">
                Exchange Rate Settings
              </h2>
              <p className="text-xs text-base-content/60 mt-1">
                Set and manage the USD to ZMW conversion exchange rates used for platform payout calculations
              </p>
            </div>
            <div className="mt-6 flex items-center justify-between">
              <span className="badge badge-accent font-semibold text-xs py-2 px-3">
                1 USD = {exchangeRate.toFixed(2)} ZMW
              </span>
              <span className="text-xs font-bold text-primary group-hover:underline">Manage rates →</span>
            </div>
          </div>
        </Link>
      </div>

      {/* Info Box */}
      <div className="card bg-base-200 border border-base-content/5 shadow-md p-6">
        <h3 className="text-base font-bold mb-3">Wallet System Overview</h3>
        <ul className="text-xs text-base-content/75 space-y-2">
          <li className="flex items-start gap-2">
            <span className="text-primary font-bold">✓</span>
            <span><strong>Developer deposits:</strong> Require manual admin verification and approval before funds are credited.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary font-bold">✓</span>
            <span><strong>Campaign funding:</strong> Developers spend exclusively from their verified wallet balance.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary font-bold">✓</span>
            <span><strong>Tester withdrawals:</strong> Testers submit payout requests; admins review, approve, and initiate bank transfers.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary font-bold">✓</span>
            <span><strong>Audit compliance:</strong> All actions are logged with actor, action, IP, timestamp, and audit notes.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary font-bold">✓</span>
            <span><strong>Real-time updates:</strong> System recalculates developer/tester ledger balances upon approved status change.</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
