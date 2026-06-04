'use client';

import { useState, useEffect, useCallback } from 'react';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ action: 'all' });

  const fetchAuditLogs = useCallback(async () => {
    try {
      setLoading(true);
      let url = `/api/admin/audit-logs?page=${page}&limit=50`;
      if (filters.action !== 'all') url += `&action=${filters.action}`;

      const res = await fetch(url);
      const data = await res.json();

      if (data.success) {
        setLogs(data.logs || []);
        setTotalPages(data.pages || 1);
        setTotal(data.total || 0);
      } else {
        setError(data.error || 'Failed to fetch logs');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  const getActionBadgeClass = (action) => {
    switch (action) {
      case 'approved': return 'badge badge-success text-success-content';
      case 'rejected': return 'badge badge-error text-error-content';
      case 'initiated': return 'badge badge-info text-info-content';
      default: return 'badge badge-ghost';
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Immutable Audit Logs</h1>
        <p className="text-sm text-base-content/60 mt-1">
          Admin actions and transaction approvals — read-only, cannot be modified
        </p>
      </div>

      {error && (
        <div className="alert alert-error shadow-sm">
          <span>{error}</span>
        </div>
      )}

      {/* Filters */}
      <div className="card bg-base-200 border border-base-content/5 shadow-md p-4">
        <div className="flex items-center gap-4">
          <label className="text-[10px] font-bold uppercase tracking-wider text-base-content/50 whitespace-nowrap">
            Filter by Action
          </label>
          <select
            value={filters.action}
            onChange={(e) => {
              setFilters({ ...filters, action: e.target.value });
              setPage(1);
            }}
            className="select select-bordered select-sm bg-base-300 w-48"
          >
            <option value="all">All Actions</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="initiated">Initiated</option>
          </select>
          {!loading && (
            <span className="ml-auto badge badge-primary font-bold text-xs">{total} total entries</span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
          <span className="loading loading-spinner loading-lg text-primary" />
          <p className="text-xs text-base-content/50">Fetching audit log entries...</p>
        </div>
      ) : logs.length === 0 ? (
        <div className="card bg-base-200 border border-base-content/5 shadow-md p-8 text-center space-y-1">
          <p className="text-base font-bold text-base-content/60">No audit logs found</p>
          <p className="text-xs text-base-content/40">Try changing the action filter or check back later.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => (
            <div
              key={log.id}
              className="card bg-base-200 border border-base-content/5 shadow-md p-5 gap-4 hover:shadow-lg transition-shadow duration-200"
            >
              <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                {/* Action Badge + Timestamp */}
                <div className="flex items-center gap-3 min-w-fit">
                  <span className={`${getActionBadgeClass(log.action)} text-[10px] font-extrabold uppercase px-2.5 py-1`}>
                    {log.action}
                  </span>
                  <span className="text-[10px] text-base-content/40">
                    {new Date(log.created_at).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-base-content/40 mb-1">Admin</p>
                  <p className="text-sm font-bold text-base-content">{log.admin?.full_name || 'Unknown'}</p>
                  <p className="text-[10px] text-base-content/50">{log.admin?.email}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-base-content/40 mb-1">User / Tester</p>
                  <p className="text-sm font-bold text-base-content">{log.transaction?.user?.full_name || 'Unknown'}</p>
                  <p className="text-[10px] text-base-content/50">{log.transaction?.user?.email || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-base-content/40 mb-1">Transaction</p>
                  <p className="text-sm font-bold capitalize text-base-content">{log.transaction?.type || 'N/A'}</p>
                  <p className="text-[10px] text-base-content/50">
                    {log.transaction?.amount_usd ? `$${parseFloat(log.transaction.amount_usd).toFixed(2)} USD` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-base-content/40 mb-1">IP Address</p>
                  <p className="font-mono text-xs text-base-content">{log.ip_address || 'N/A'}</p>
                </div>
              </div>

              {/* Reason Box */}
              {log.reason && (
                <div className="bg-base-300 border border-base-content/5 rounded-lg px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-base-content/40 mb-1">Reason</p>
                  <p className="text-xs text-base-content/80">{log.reason}</p>
                </div>
              )}

              {/* Footer */}
              <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-base-content/5 text-[10px] text-base-content/40 font-mono">
                <span>Log: {log.id?.slice(0, 12)}...</span>
                <span>TX: {log.wallet_transaction_id?.slice(0, 12)}...</span>
                {log.user_agent && (
                  <span className="ml-auto truncate max-w-[200px]">
                    {log.user_agent.split('/')[0]}
                  </span>
                )}
              </div>
            </div>
          ))}
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

      {/* Security Info */}
      <div className="card bg-base-200 border border-base-content/5 shadow-md p-6">
        <h3 className="font-bold text-sm mb-3">🔒 Audit Trail Security</h3>
        <ul className="text-xs text-base-content/70 space-y-2">
          <li className="flex items-start gap-2"><span className="text-primary font-bold">✓</span><span><strong>Immutable:</strong> Logs cannot be modified or deleted by anyone, including superadmins.</span></li>
          <li className="flex items-start gap-2"><span className="text-primary font-bold">✓</span><span><strong>Admin tracked:</strong> Every action records the performing admin's identity.</span></li>
          <li className="flex items-start gap-2"><span className="text-primary font-bold">✓</span><span><strong>Mandatory reasoning:</strong> All approvals and rejections require a documented reason.</span></li>
          <li className="flex items-start gap-2"><span className="text-primary font-bold">✓</span><span><strong>IP logging:</strong> Source IP address captured for every administrative action.</span></li>
          <li className="flex items-start gap-2"><span className="text-primary font-bold">✓</span><span><strong>Precise timestamps:</strong> Exact UTC time recorded for forensic accuracy.</span></li>
        </ul>
      </div>
    </div>
  );
}
