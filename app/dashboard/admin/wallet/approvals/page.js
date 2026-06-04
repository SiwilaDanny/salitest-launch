'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export default function ApprovalsPage() {
  const searchParams = useSearchParams();
  const typeFilter = searchParams.get('type') || 'all';

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionInProgress, setActionInProgress] = useState(null);
  const [alertMsg, setAlertMsg] = useState(null);

  const [approvalReason, setApprovalReason] = useState({});
  const [rejectionReasons, setRejectionReasons] = useState({});
  const [showReasonModal, setShowReasonModal] = useState({});

  async function fetchPendingTransactions() {
    try {
      setLoading(true);
      let url = '/api/admin/wallet/transactions?approval_status=requested';
      if (typeFilter !== 'all') url += `&type=${typeFilter}`;

      const res = await fetch(url);
      const data = await res.json();

      if (data.success) {
        setTransactions(data.transactions || []);
      } else {
        setError(data.error || 'Failed to fetch transactions');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPendingTransactions();
  }, [typeFilter]);

  async function handleApprove(transactionId, reason) {
    try {
      setActionInProgress(transactionId);
      const res = await fetch('/api/admin/wallet/approve-deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_id: transactionId,
          approval_reason: reason,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setTransactions(transactions.filter((tx) => tx.id !== transactionId));
        setApprovalReason((prev) => {
          const newState = { ...prev };
          delete newState[transactionId];
          return newState;
        });
        setAlertMsg({ type: 'success', text: 'Transaction approved successfully' });
      } else {
        setAlertMsg({ type: 'error', text: data.error || 'Failed to approve transaction' });
      }
    } catch (err) {
      setAlertMsg({ type: 'error', text: err.message });
    } finally {
      setActionInProgress(null);
    }
  }

  async function handleReject(transactionId) {
    const reason = rejectionReasons[transactionId];
    if (!reason || reason.trim().length < 5) {
      setAlertMsg({ type: 'error', text: 'Rejection reason must be at least 5 characters' });
      return;
    }

    try {
      setActionInProgress(transactionId);
      const res = await fetch('/api/admin/wallet/reject-deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_id: transactionId,
          rejection_reason: reason,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setTransactions(transactions.filter((tx) => tx.id !== transactionId));
        setRejectionReasons((prev) => {
          const newState = { ...prev };
          delete newState[transactionId];
          return newState;
        });
        setShowReasonModal((prev) => {
          const newState = { ...prev };
          delete newState[transactionId];
          return newState;
        });
        setAlertMsg({ type: 'success', text: 'Transaction rejected successfully' });
      } else {
        setAlertMsg({ type: 'error', text: data.error || 'Failed to reject transaction' });
      }
    } catch (err) {
      setAlertMsg({ type: 'error', text: err.message });
    } finally {
      setActionInProgress(null);
    }
  }

  const formatCurrency = (usd, zmw) => {
    return `$${parseFloat(usd).toFixed(2)} USD / ${parseFloat(zmw).toFixed(2)} ZMW`;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <span className="loading loading-spinner loading-lg text-primary" />
        <p className="text-sm text-base-content/60">Loading pending transactions...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Approve Deposits &amp; Withdrawals</h1>
        <p className="text-sm text-base-content/60 mt-1">Review pending transactions and process them</p>
      </div>

      {alertMsg && (
        <div className={`alert ${alertMsg.type === 'success' ? 'alert-success' : 'alert-error'} shadow-sm flex justify-between`}>
          <span>{alertMsg.text}</span>
          <button className="btn btn-ghost btn-xs" onClick={() => setAlertMsg(null)}>✕</button>
        </div>
      )}

      {error && (
        <div className="alert alert-error shadow-sm">
          <span>{error}</span>
        </div>
      )}

      {transactions.length === 0 ? (
        <div className="card bg-base-200 border border-base-content/5 shadow-md p-8 text-center space-y-2">
          <p className="text-base font-bold text-base-content/60">No pending transactions</p>
          <p className="text-xs text-base-content/40">All transfer requests have been processed successfully.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {transactions.map((tx) => (
            <div
              key={tx.id}
              className="card bg-base-200 border border-base-content/5 shadow-md p-6 gap-4"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`badge text-[10px] font-extrabold px-2.5 py-1 ${
                        tx.type === 'deposit'
                          ? 'badge-success text-success-content'
                          : 'badge-info text-info-content'
                      }`}
                    >
                      {tx.type === 'deposit' ? 'DEPOSIT' : 'WITHDRAWAL'}
                    </span>
                    <span className="text-[10px] text-base-content/40">
                      {new Date(tx.created_at).toLocaleString()}
                    </span>
                  </div>
                  <h3 className="font-extrabold text-base-content text-lg">
                    {tx.user?.full_name || 'Anonymous User'}
                  </h3>
                  <p className="text-xs text-base-content/50">{tx.user?.email}</p>
                </div>
                <div className="text-left sm:text-right space-y-1">
                  <p className="text-xl font-black text-base-content">
                    {formatCurrency(tx.amount_usd, tx.amount_zmw)}
                  </p>
                  <span className="badge badge-outline badge-sm text-[10px] uppercase font-bold text-base-content/50">
                    Role: {tx.user?.role || 'tester'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-4 border-y border-base-content/5">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-base-content/40">Transaction ID</p>
                  <p className="font-mono text-xs text-base-content mt-1">{tx.id}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-base-content/40">Flow Status</p>
                  <p className="text-xs font-semibold capitalize text-base-content mt-1">{tx.status}</p>
                </div>
                {tx.lenco_reference && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-base-content/40">Lenco Reference</p>
                    <p className="font-mono text-xs text-base-content mt-1">{tx.lenco_reference}</p>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3">
                <input
                  type="text"
                  placeholder={
                    tx.type === 'deposit'
                      ? 'Note (e.g. "Verified proof of deposit")'
                      : 'Note (e.g. "Approved payout request")'
                  }
                  value={approvalReason[tx.id] || ''}
                  onChange={(e) =>
                    setApprovalReason((prev) => ({
                      ...prev,
                      [tx.id]: e.target.value,
                    }))
                  }
                  className="input input-bordered input-sm w-full flex-1 text-sm bg-base-300"
                  disabled={actionInProgress === tx.id}
                />

                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => handleApprove(tx.id, approvalReason[tx.id] || 'Approved by admin')}
                    disabled={actionInProgress === tx.id}
                    className="btn btn-success btn-sm flex-1 sm:flex-none font-bold text-xs"
                  >
                    {actionInProgress === tx.id ? <span className="loading loading-spinner loading-xs" /> : 'Approve'}
                  </button>

                  <button
                    onClick={() => setShowReasonModal((prev) => ({ ...prev, [tx.id]: !prev[tx.id] }))}
                    disabled={actionInProgress === tx.id}
                    className="btn btn-error btn-sm flex-1 sm:flex-none font-bold text-xs"
                  >
                    Reject
                  </button>
                </div>
              </div>

              {showReasonModal[tx.id] && (
                <div className="card bg-error/10 border border-error/20 p-4 rounded-lg space-y-3 mt-2 animate-slide-up">
                  <h4 className="text-xs font-bold text-error uppercase tracking-wider">Provide Rejection Reason</h4>
                  <textarea
                    placeholder="Provide a detailed explanation of the rejection for the user (minimum 5 characters)..."
                    value={rejectionReasons[tx.id] || ''}
                    onChange={(e) =>
                      setRejectionReasons((prev) => ({
                        ...prev,
                        [tx.id]: e.target.value,
                      }))
                    }
                    className="textarea textarea-bordered textarea-sm w-full text-sm bg-base-300 border-error/20"
                    rows="3"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleReject(tx.id)}
                      disabled={actionInProgress === tx.id}
                      className="btn btn-error btn-sm text-xs font-bold"
                    >
                      Confirm Rejection
                    </button>
                    <button
                      onClick={() =>
                        setShowReasonModal((prev) => ({ ...prev, [tx.id]: false }))
                      }
                      className="btn btn-ghost btn-sm text-xs font-bold"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
