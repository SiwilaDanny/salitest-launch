'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function MyWalletPage() {
  const [profile, setProfile] = useState(null);
  const [balance, setBalance] = useState({
    balance_usd: 0,
    balance_zmw: 0,
    total_deposited_usd: 0,
    total_withdrawn_usd: 0,
  });
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [exchangeRate, setExchangeRate] = useState(null);
  
  // Form State
  const [amountUsd, setAmountUsd] = useState('');
  const [phone, setPhone] = useState('');
  const [operator, setOperator] = useState('mtn');
  
  // Status State
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const supabase = createClient();

  const getActiveRole = () => {
    if (!profile) return 'developer';
    if (profile.role === 'admin' && typeof window !== 'undefined') {
      const adminView = localStorage.getItem('salitest_admin_active_view');
      if (adminView) return adminView;
    }
    return profile.role || 'developer';
  };
  const activeRole = getActiveRole();
  const isTester = activeRole === 'tester';

  const fetchBalance = useCallback(async () => {
    try {
      setBalanceLoading(true);
      const res = await fetch('/api/wallet/balance');
      const data = await res.json();
      if (data.success) {
        setBalance({
          balance_usd: data.balance_usd,
          balance_zmw: data.balance_zmw,
          total_deposited_usd: data.total_deposited_usd,
          total_withdrawn_usd: data.total_withdrawn_usd,
        });
      }
    } catch (err) {
      console.error('Error fetching balance:', err);
    } finally {
      setBalanceLoading(false);
    }
  }, []);

  const fetchTransactions = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('wallet_transactions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
    } catch (err) {
      console.error('Error fetching transactions:', err);
    }
  }, [supabase]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      
      // Get user profile
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        setProfile(userProfile);
        // Pre-fill phone if saved in profile
        if (userProfile?.mobile_money_number) {
          setPhone(userProfile.mobile_money_number);
        }
        if (userProfile?.mobile_money_operator) {
          setOperator(userProfile.mobile_money_operator);
        }
      }

      // Fetch balance, transactions, and exchange rate
      const ratePromise = fetch('/api/wallet/exchange-rate')
        .then(r => r.json())
        .then(d => { if (d.success) setExchangeRate(d.rate); })
        .catch(() => {});

      await Promise.all([fetchBalance(), fetchTransactions(), ratePromise]);
    } catch (err) {
      setErrorMsg('Failed to load wallet data.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [supabase, fetchBalance, fetchTransactions]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amountUsd || !phone || !operator) {
      setErrorMsg('Please fill in all fields.');
      return;
    }

    const numericAmount = parseFloat(amountUsd);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setErrorMsg('Please enter a valid positive amount.');
      return;
    }

    if (isTester && numericAmount > balance.balance_usd) {
      setErrorMsg('Insufficient USD balance for withdrawal request.');
      return;
    }

    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const endpoint = isTester 
        ? '/api/wallet/withdrawal/request' 
        : '/api/wallet/deposit/initiate';

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount_usd: numericAmount,
          phone,
          operator,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Request failed.');
      }

      setSuccessMsg(data.message || 'Request successfully initiated!');
      setAmountUsd('');
      
      // Reload balance and transactions
      await Promise.all([fetchBalance(), fetchTransactions()]);
    } catch (err) {
      setErrorMsg(err.message || 'An error occurred. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status, approvalStatus) => {
    if (approvalStatus === 'rejected') {
      return <span className="badge badge-error badge-sm uppercase font-bold text-[10px]">Rejected</span>;
    }
    if (status === 'completed') {
      return <span className="badge badge-success badge-sm uppercase font-bold text-[10px]">Completed</span>;
    }
    if (status === 'failed') {
      return <span className="badge badge-error badge-sm uppercase font-bold text-[10px]">Failed</span>;
    }
    return <span className="badge badge-warning badge-sm uppercase font-bold text-[10px]">Pending Approval</span>;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <span className="loading loading-spinner loading-lg text-primary" />
        <p className="text-xs text-base-content/50 font-bold uppercase tracking-wider">Syncing Wallet Ledger...</p>
      </div>
    );
  }



  return (
    <div className="space-y-8 max-w-5xl mx-auto px-4 pb-12">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">My Wallet</h1>
        <p className="text-sm text-base-content/60 mt-1">
          {isTester 
            ? 'Manage your tester earnings and mobile money withdrawals' 
            : 'Fund your developer account to run user testing campaigns'}
        </p>
      </div>

      {successMsg && (
        <div className="alert alert-success shadow-sm text-sm">
          <span>✓ {successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="alert alert-error shadow-sm text-sm">
          <span>⚠️ {errorMsg}</span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card bg-gradient-to-br from-primary/10 to-transparent border border-primary/20 shadow-md">
          <div className="card-body p-6 gap-1">
            <span className="text-[10px] text-base-content/50 uppercase tracking-widest font-black">USD Balance</span>
            <span className="text-3xl font-black text-primary">
              {balanceLoading ? (
                <span className="loading loading-dots loading-sm" />
              ) : (
                `$${balance.balance_usd.toFixed(2)}`
              )}
            </span>
            <span className="text-[10px] text-base-content/40 mt-1">Available for use</span>
          </div>
        </div>

        <div className="card bg-gradient-to-br from-secondary/10 to-transparent border border-secondary/20 shadow-md">
          <div className="card-body p-6 gap-1">
            <span className="text-[10px] text-base-content/50 uppercase tracking-widest font-black">Estimated ZMW</span>
            <span className="text-3xl font-black text-secondary">
              {balanceLoading ? (
                <span className="loading loading-dots loading-sm" />
              ) : (
                `ZK ${balance.balance_zmw.toFixed(2)}`
              )}
            </span>
            <span className="text-[10px] text-base-content/40 mt-1">
              {exchangeRate ? `Rate: 1 USD = ${exchangeRate.toFixed(2)} ZMW` : 'Converted at current rate'}
            </span>
          </div>
        </div>

        <div className="card bg-base-200 border border-base-content/5 shadow-md">
          <div className="card-body p-6 gap-1">
            <span className="text-[10px] text-base-content/50 uppercase tracking-widest font-black">
              {isTester ? 'Total Withdrawn' : 'Total Deposited'}
            </span>
            <span className="text-3xl font-black text-base-content">
              {balanceLoading ? (
                <span className="loading loading-dots loading-sm" />
              ) : (
                `$${(isTester ? balance.total_withdrawn_usd : balance.total_deposited_usd).toFixed(2)}`
              )}
            </span>
            <span className="text-[10px] text-base-content/40 mt-1">Lifetime wallet stats</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.3fr] gap-8">
        {/* Transaction Action Form */}
        <div className="card bg-base-200 border border-base-content/5 shadow-md p-6 h-fit space-y-6">
          <div>
            <h3 className="font-extrabold text-lg">
              {isTester ? '💸 Request Withdrawal' : '💳 Fund Wallet'}
            </h3>
            <p className="text-xs text-base-content/50 mt-1">
              {isTester 
                ? 'Withdraw your earned test rewards to Zambian Mobile Money' 
                : 'Deposit funds instantly via Lenco Mobile Money Push Prompt'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="form-control">
              <label className="label py-1">
                <span className="label-text text-xs font-bold uppercase tracking-wider text-base-content/50">Amount (USD)</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="1"
                placeholder={isTester ? `Available: $${balance.balance_usd.toFixed(2)}` : 'Enter deposit amount'}
                className="input input-bordered w-full bg-base-300 font-medium"
                value={amountUsd}
                onChange={(e) => setAmountUsd(e.target.value)}
                required
              />
              {amountUsd && !isNaN(parseFloat(amountUsd)) && (
                <div className="flex flex-col gap-1 mt-1">
                  <span className="text-xs text-secondary font-bold">
                    {isTester ? 'Receiving: ' : 'Cost: '}
                    ZK {(parseFloat(amountUsd) * (exchangeRate || 26.0)).toFixed(2)} ZMW
                    {!exchangeRate && ' (est.)'}
                  </span>
                  {isTester && parseFloat(amountUsd) > balance.balance_usd && (
                    <span className="text-xs text-error font-bold">
                      ⚠️ Amount exceeds your available balance of ${balance.balance_usd.toFixed(2)}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="form-control">
              <label className="label py-1">
                <span className="label-text text-xs font-bold uppercase tracking-wider text-base-content/50">Mobile Operator</span>
              </label>
              <select
                className="select select-bordered w-full bg-base-300 font-semibold"
                value={operator}
                onChange={(e) => setOperator(e.target.value)}
                required
              >
                <option value="mtn">MTN Mobile Money</option>
                <option value="airtel">Airtel Money</option>
                <option value="zamtel">Zamtel Kwacha</option>
              </select>
            </div>

            <div className="form-control">
              <label className="label py-1">
                <span className="label-text text-xs font-bold uppercase tracking-wider text-base-content/50">Mobile Number</span>
              </label>
              <input
                type="tel"
                placeholder="e.g. 0966XXXXXX"
                className="input input-bordered w-full bg-base-300 font-mono"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
              <span className="text-[10px] text-base-content/40 mt-1">
                {isTester 
                  ? 'Your mobile money account where payout will be sent'
                  : 'You will receive a USSD push prompt on this number to authorize the deposit.'}
              </span>
            </div>

            <button 
              type="submit" 
              className={`btn btn-primary btn-block font-bold mt-4`}
              disabled={actionLoading || (isTester && amountUsd && !isNaN(parseFloat(amountUsd)) && parseFloat(amountUsd) > balance.balance_usd)}
            >
              {actionLoading ? (
                'Processing Request...'
              ) : isTester && amountUsd && !isNaN(parseFloat(amountUsd)) && parseFloat(amountUsd) > balance.balance_usd ? (
                'Insufficient Funds'
              ) : amountUsd && !isNaN(parseFloat(amountUsd)) ? (
                isTester ? (
                  `Withdraw ZK ${(parseFloat(amountUsd) * (exchangeRate || 26.0)).toFixed(2)} ZMW`
                ) : (
                  `Pay ZK ${(parseFloat(amountUsd) * (exchangeRate || 26.0)).toFixed(2)} ZMW & Deposit`
                )
              ) : (
                isTester ? 'Confirm Withdrawal' : 'Initiate Deposit'
              )}
            </button>
          </form>
        </div>

        {/* Transaction History */}
        <div className="card bg-base-200 border border-base-content/5 shadow-md p-6 space-y-6">
          <div>
            <h3 className="font-extrabold text-lg">Transaction History</h3>
            <p className="text-xs text-base-content/50 mt-1">Audit log of your deposits and withdrawals</p>
          </div>

          {transactions.length === 0 ? (
            <div className="py-12 text-center text-base-content/40">
              <p className="font-bold">No transactions found</p>
              <p className="text-xs">Your deposits and withdrawals will show up here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-base-content/5 bg-base-300">
              <table className="table table-sm">
                <thead>
                  <tr className="bg-base-200 text-[10px] font-black uppercase text-base-content/40 border-b border-base-content/5">
                    <th>Date</th>
                    <th>Type</th>
                    <th>Amount (USD)</th>
                    <th>Mobile Wallet</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="hover hover:bg-base-100 border-b border-base-content/5 transition-colors">
                      <td className="text-[10px] text-base-content/50 font-medium">
                        {new Date(tx.created_at).toLocaleDateString()}
                      </td>
                      <td className="capitalize font-bold text-xs text-base-content">
                        {tx.type}
                      </td>
                      <td className="font-mono font-bold text-xs">
                        ${parseFloat(tx.amount_usd).toFixed(2)}
                      </td>
                      <td className="font-mono text-[10px] text-base-content/60">
                        {tx.payout_phone ? (
                          <>
                            <span className="uppercase font-extrabold tracking-wider">{tx.payout_operator}</span>:{' '}
                            {tx.payout_phone}
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        {getStatusBadge(tx.status, tx.approval_status)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
