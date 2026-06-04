'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';

export default function TransactionsPage() {
  const searchParams = useSearchParams();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [filters, setFilters] = useState({
    type: searchParams.get('type') || 'all',
    status: searchParams.get('status') || 'all',
    approval_status: searchParams.get('approval_status') || 'all',
  });

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);
      let url = `/api/admin/wallet/transactions?page=${page}&limit=50`;

      if (filters.type !== 'all') url += `&type=${filters.type}`;
      if (filters.status !== 'all') url += `&status=${filters.status}`;
      if (filters.approval_status !== 'all') url += `&approval_status=${filters.approval_status}`;

      const res = await fetch(url);
      const data = await res.json();

      if (data.success) {
        setTransactions(data.transactions || []);
        setTotalPages(data.pages || 1);
        setTotal(data.total || 0);
      } else {
        setError(data.error || 'Failed to fetch transactions');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed':
        return 'badge badge-success text-success-content';
      case 'pending':
        return 'badge badge-warning text-warning-content';
      case 'failed':
        return 'badge badge-error text-error-content';
      case 'refunded':
        return 'badge badge-info text-info-content';
      default:
        return 'badge badge-ghost';
    }
  };

  const getApprovalBadge = (approval_status) => {
    switch (approval_status) {
      case 'approved':
        return 'badge badge-success text-success-content';
      case 'requested':
        return 'badge badge-warning text-warning-content';
      case 'rejected':
        return 'badge badge-error text-error-content';
      default:
        return 'badge badge-ghost';
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Wallet Transactions</h1>
        <p className="text-sm text-base-content/60 mt-1">View and filter user deposit and withdrawal ledger logs</p>
      </div>

      {error && (
        <div className="alert alert-error shadow-sm">
          <span>{error}</span>
        </div>
      )}

      {/* Filters Card */}
      <div className="card bg-base-200 border border-base-content/5 shadow-md p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-base-content/50 mb-2">
              Transaction Type
            </label>
            <select
              value={filters.type}
              onChange={(e) => {
                setFilters({ ...filters, type: e.target.value });
                setPage(1);
              }}
              className="select select-bordered select-sm w-full bg-base-300"
            >
              <option value="all">All Types</option>
              <option value="deposit">Deposits</option>
              <option value="withdrawal">Withdrawals</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-base-content/50 mb-2">
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => {
                setFilters({ ...filters, status: e.target.value });
                setPage(1);
              }}
              className="select select-bordered select-sm w-full bg-base-300"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-base-content/50 mb-2">
              Approval Status
            </label>
            <select
              value={filters.approval_status}
              onChange={(e) => {
                setFilters({ ...filters, approval_status: e.target.value });
                setPage(1);
              }}
              className="select select-bordered select-sm w-full bg-base-300"
            >
              <option value="all">All Approval States</option>
              <option value="requested">Requested</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <div className="bg-base-300 text-xs font-semibold px-4 py-2.5 rounded-lg border border-base-content/5 flex justify-between items-center">
            <span className="text-base-content/50 uppercase text-[10px] tracking-wider font-bold">Showing</span>
            <span className="badge badge-primary font-bold text-xs">{transactions.length} of {total}</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
          <span className="loading loading-spinner loading-lg text-primary" />
          <p className="text-xs text-base-content/50">Fetching ledger rows...</p>
        </div>
      ) : transactions.length === 0 ? (
        <div className="card bg-base-200 border border-base-content/5 shadow-md p-8 text-center space-y-1">
          <p className="text-base font-bold text-base-content/60">No transactions found</p>
          <p className="text-xs text-base-content/40">Try adjusting your filter selection.</p>
        </div>
      ) : (
        <div className="card bg-base-200 border border-base-content/5 shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table table-zebra table-md w-full">
              <thead>
                <tr className="border-b border-base-content/10">
                  <th className="font-bold text-base-content/60">User</th>
                  <th className="font-bold text-base-content/60">Type</th>
                  <th className="font-bold text-base-content/60 text-right">Amount</th>
                  <th className="font-bold text-base-content/60">Status</th>
                  <th className="font-bold text-base-content/60">Approval</th>
                  <th className="font-bold text-base-content/60">Date &amp; Time</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover border-b border-base-content/5 last:border-none">
                    <td>
                      <div className="space-y-0.5">
                        <p className="font-bold text-base-content">{tx.user?.full_name || 'Anonymous'}</p>
                        <p className="text-xs text-base-content/50">{tx.user?.email}</p>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`badge text-[10px] font-extrabold px-2.5 py-1 ${
                          tx.type === 'deposit'
                            ? 'badge-success text-success-content'
                            : 'badge-info text-info-content'
                        }`}
                      >
                        {tx.type === 'deposit' ? 'DEPOSIT' : 'WITHDRAWAL'}
                      </span>
                    </td>
                    <td className="text-right font-mono text-xs">
                      <div className="space-y-0.5">
                        <p className="font-extrabold text-base-content">${tx.amount_usd.toFixed(2)}</p>
                        <p className="text-[10px] text-base-content/40">{tx.amount_zmw.toFixed(2)} ZMW</p>
                      </div>
                    </td>
                    <td>
                      <span className={`${getStatusBadge(tx.status)} text-[10px] font-bold uppercase`}>
                        {tx.status}
                      </span>
                    </td>
                    <td>
                      <span className={`${getApprovalBadge(tx.approval_status)} text-[10px] font-bold uppercase`}>
                        {tx.approval_status}
                      </span>
                    </td>
                    <td className="text-xs text-base-content/60">
                      <div>
                        <p>{new Date(tx.created_at).toLocaleDateString()}</p>
                        <p className="text-[10px] text-base-content/40">{new Date(tx.created_at).toLocaleTimeString()}</p>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex justify-center items-center gap-4">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="btn btn-outline btn-sm font-bold text-xs"
          >
            ← Previous
          </button>

          <span className="text-xs text-base-content/60 font-semibold">
            Page {page} of {totalPages}
          </span>

          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="btn btn-outline btn-sm font-bold text-xs"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
