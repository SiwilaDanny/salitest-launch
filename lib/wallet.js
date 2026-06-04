/**
 * Wallet System Utilities
 * Core business logic for deposits, withdrawals, and wallet management
 */

import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { isIP } from 'node:net';
import logger from './logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const supabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export function getClientIpFromRequest(req) {
  const forwardedFor = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  const candidate = forwardedFor?.split(',')[0]?.trim() || realIp?.trim();

  return candidate && isIP(candidate) ? candidate : null;
}

// ─── WALLET QUERIES ───────────────────────────────────────────

/**
 * Get wallet balance for a user
 * @param {string} userId - User ID
 * @returns {Promise<{balance_usd, balance_zmw, total_deposited_usd, total_withdrawn_usd}>}
 */
export async function getWalletBalance(userId) {
  try {
    const { data, error } = await supabase
      .from('account_wallets')
      .select('balance_usd, balance_zmw, total_deposited_usd, total_withdrawn_usd, updated_at')
      .eq('user_id', userId)
      .single();

    if (error) {
      logger.error('[wallet] getWalletBalance failed', { userId, error });
      throw error;
    }

    return data;
  } catch (err) {
    logger.error('[wallet] getWalletBalance exception', { userId, error: err.message });
    throw err;
  }
}

/**
 * Get current USD to ZMW exchange rate
 * @returns {Promise<number>}
 */
export async function getExchangeRate() {
  try {
    const { data, error } = await supabase
      .from('admin_exchange_rates')
      .select('rate_usd_to_zmw')
      .lte('effective_at', new Date().toISOString())
      .order('effective_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "no rows" which is okay, return default
      logger.warn('[wallet] getExchangeRate query error', { error });
    }

    return data?.rate_usd_to_zmw || 26.0;
  } catch (err) {
    logger.error('[wallet] getExchangeRate exception', { error: err.message });
    return 26.0; // Default fallback
  }
}

// ─── VELOCITY CHECKS ──────────────────────────────────────────

/**
 * Check if user has exceeded transaction velocity limits
 * @param {string} userId - User ID
 * @param {string} transactionType - 'deposit' or 'withdrawal'
 * @param {number} hourlyLimit - Max transactions per hour (default 5)
 * @param {number} dailyLimit - Max transactions per day (default 50)
 * @returns {Promise<{allowed: boolean, hourly_count: number, daily_count: number, reason: string}>}
 */
export async function checkVelocityLimit(
  userId,
  transactionType,
  hourlyLimit = 5,
  dailyLimit = 50
) {
  try {
    const { data, error } = await supabase.rpc('check_velocity_limit', {
      p_user_id: userId,
      p_transaction_type: transactionType,
      p_hourly_limit: hourlyLimit,
      p_daily_limit: dailyLimit,
    });

    if (error) {
      logger.error('[wallet] checkVelocityLimit failed', { userId, transactionType, error });
      throw error;
    }

    logger.info('[wallet] Velocity check result', {
      userId,
      transactionType,
      ...data[0],
    });

    return data[0]; // Returns {allowed, hourly_count, daily_count, reason}
  } catch (err) {
    logger.error('[wallet] checkVelocityLimit exception', { userId, error: err.message });
    throw err;
  }
}

/**
 * Record transaction in velocity check table
 * @param {string} userId - User ID
 * @param {string} transactionType - 'deposit' or 'withdrawal'
 */
export async function recordVelocityTransaction(userId, transactionType) {
  try {
    // Increment transaction counts via SQL update
    const { error } = await supabase.rpc('record_transaction_velocity', {
      p_user_id: userId,
      p_transaction_type: transactionType,
    });

    if (error) {
      logger.warn('[wallet] recordVelocityTransaction warning', { userId, transactionType, error });
      // Don't throw - this is non-critical
    }
  } catch (err) {
    logger.warn('[wallet] recordVelocityTransaction exception', { userId, error: err.message });
  }
}

// ─── IP LOGGING ────────────────────────────────────────────────

/**
 * Log user IP address for security tracking
 * @param {string} userId - User ID
 * @param {string|null} ipAddress - IP address from request
 * @param {string} userAgent - User agent string
 * @param {string} transactionType - Type of transaction
 * @returns {Promise<string|null>} - Log ID
 */
export async function logIPAddress(userId, ipAddress, userAgent, transactionType) {
  if (!ipAddress) {
    logger.warn('[wallet] Skipping IP log because no client IP was available', {
      userId,
      transactionType,
    });
    return null;
  }

  try {
    const { data, error } = await supabase.rpc('log_ip_address', {
      p_user_id: userId,
      p_ip_address: ipAddress,
      p_user_agent: userAgent,
      p_transaction_type: transactionType,
    });

    if (error) {
      logger.warn('[wallet] logIPAddress failed', { userId, ipAddress, error });
      return null;
    }

    return data; // Returns log ID
  } catch (err) {
    logger.warn('[wallet] logIPAddress exception', { userId, error: err.message });
    return null;
  }
}

// ─── TRANSACTION CREATION ─────────────────────────────────────

/**
 * Create a deposit transaction
 * @param {string} userId - User ID initiating deposit
 * @param {number} amountUsd - Amount in USD
 * @param {string|null} ipAddress - IP address from request
 * @param {string} userAgent - User agent string
 * @param {string|null} phone - Mobile money phone number
 * @param {string|null} operator - Mobile money operator
 * @returns {Promise<object>} - Transaction record with {id, status, approval_status}
 */
export async function createDepositTransaction(userId, amountUsd, ipAddress, userAgent, phone = null, operator = null) {
  try {
    // Log IP for security
    await logIPAddress(userId, ipAddress, userAgent, 'deposit');

    // Get current exchange rate
    const exchangeRate = await getExchangeRate();
    const amountZmw = amountUsd * exchangeRate;

    // Create transaction
    const { data, error } = await supabase
      .from('wallet_transactions')
      .insert([
        {
          user_id: userId,
          type: 'deposit',
          amount_usd: amountUsd,
          amount_zmw: amountZmw,
          status: 'pending',
          approval_status: 'requested',
          ip_address: ipAddress,
          user_agent: userAgent,
          payout_phone: phone,
          payout_operator: operator,
        },
      ])
      .select('id, status, approval_status, amount_usd, amount_zmw, created_at');

    if (error) {
      logger.error('[wallet] createDepositTransaction insert failed', {
        userId,
        amountUsd,
        error,
      });
      throw error;
    }

    logger.info('[wallet] Deposit transaction created', {
      transactionId: data[0].id,
      userId,
      amountUsd,
    });

    return data[0];
  } catch (err) {
    logger.error('[wallet] createDepositTransaction exception', {
      userId,
      amountUsd,
      error: err.message,
    });
    throw err;
  }
}

/**
 * Create a withdrawal request transaction (user-initiated)
 * @param {string} userId - User ID requesting withdrawal
 * @param {number} amountUsd - Amount in USD
 * @param {string|null} ipAddress - IP address from request
 * @param {string} userAgent - User agent string
 * @param {string|null} phone - Mobile money phone number
 * @param {string|null} operator - Mobile money operator
 * @returns {Promise<object>} - Transaction record
 */
export async function createWithdrawalRequest(userId, amountUsd, ipAddress, userAgent, phone = null, operator = null) {
  try {
    // Check wallet balance
    const wallet = await getWalletBalance(userId);
    if (wallet.balance_usd < amountUsd) {
      throw new Error('Insufficient wallet balance');
    }

    // Log IP for security
    await logIPAddress(userId, ipAddress, userAgent, 'withdrawal');

    // Get current exchange rate
    const exchangeRate = await getExchangeRate();
    const amountZmw = amountUsd * exchangeRate;

    // Create transaction
    const { data, error } = await supabase
      .from('wallet_transactions')
      .insert([
        {
          user_id: userId,
          type: 'withdrawal',
          amount_usd: amountUsd,
          amount_zmw: amountZmw,
          status: 'pending',
          approval_status: 'requested',
          ip_address: ipAddress,
          user_agent: userAgent,
          initiated_by_admin: false,
          payout_phone: phone,
          payout_operator: operator,
        },
      ])
      .select('id, status, approval_status, amount_usd, amount_zmw, created_at');

    if (error) {
      logger.error('[wallet] createWithdrawalRequest insert failed', {
        userId,
        amountUsd,
        error,
      });
      throw error;
    }

    logger.info('[wallet] Withdrawal request created', {
      transactionId: data[0].id,
      userId,
      amountUsd,
    });

    return data[0];
  } catch (err) {
    logger.error('[wallet] createWithdrawalRequest exception', {
      userId,
      amountUsd,
      error: err.message,
    });
    throw err;
  }
}

/**
 * Get transaction details
 * @param {string} transactionId - Transaction ID
 * @returns {Promise<object>} - Transaction details
 */
export async function getTransaction(transactionId) {
  try {
    const { data, error } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('id', transactionId)
      .single();

    if (error) {
      logger.error('[wallet] getTransaction failed', { transactionId, error });
      throw error;
    }

    return data;
  } catch (err) {
    logger.error('[wallet] getTransaction exception', { transactionId, error: err.message });
    throw err;
  }
}

/**
 * Get all wallet transactions for a user
 * @param {string} userId - User ID
 * @param {number} limit - Number of transactions to fetch (default 50)
 * @param {number} offset - Pagination offset (default 0)
 * @returns {Promise<array>} - Transaction list
 */
export async function getUserWalletTransactions(userId, limit = 50, offset = 0) {
  try {
    const { data, error, count } = await supabase
      .from('wallet_transactions')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error('[wallet] getUserWalletTransactions failed', { userId, error });
      throw error;
    }

    return { transactions: data, total: count };
  } catch (err) {
    logger.error('[wallet] getUserWalletTransactions exception', {
      userId,
      error: err.message,
    });
    throw err;
  }
}

// ─── ADMIN OPERATIONS ─────────────────────────────────────────

/**
 * Approve a wallet transaction (admin only)
 * @param {string} transactionId - Transaction ID
 * @param {string} approvalReason - Reason for approval
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function approveWalletTransaction(transactionId, approvalReason = 'Approved by admin') {
  try {
    const { data, error } = await supabase.rpc('approve_wallet_transaction', {
      p_transaction_id: transactionId,
      p_approval_reason: approvalReason,
    });

    if (error) {
      logger.error('[wallet] approveWalletTransaction failed', {
        transactionId,
        approvalReason,
        error,
      });
      throw error;
    }

    if (data && data[0]?.success) {
      // Since the PostgreSQL function only credits deposits, we handle withdrawal debits here in JS.
      const { data: tx } = await supabase
        .from('wallet_transactions')
        .select('type, user_id, amount_usd')
        .eq('id', transactionId)
        .single();

      if (tx && tx.type === 'withdrawal') {
        const { data: wallet } = await supabase
          .from('account_wallets')
          .select('balance_usd, total_withdrawn_usd')
          .eq('user_id', tx.user_id)
          .single();

        if (wallet) {
          const newBalanceUsd = parseFloat(wallet.balance_usd) - parseFloat(tx.amount_usd);
          const newTotalWithdrawn = parseFloat(wallet.total_withdrawn_usd) + parseFloat(tx.amount_usd);

          await supabase
            .from('account_wallets')
            .update({
              balance_usd: newBalanceUsd,
              total_withdrawn_usd: newTotalWithdrawn,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', tx.user_id);
        }
      }
    }

    logger.info('[wallet] Transaction approved', {
      transactionId,
      approvalReason,
      result: data[0],
    });

    return data[0]; // Returns {success, message}
  } catch (err) {
    logger.error('[wallet] approveWalletTransaction exception', {
      transactionId,
      error: err.message,
    });
    throw err;
  }
}

/**
 * Reject a wallet transaction (admin only)
 * @param {string} transactionId - Transaction ID
 * @param {string} rejectionReason - Reason for rejection
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function rejectWalletTransaction(transactionId, rejectionReason) {
  try {
    const { data, error } = await supabase.rpc('reject_wallet_transaction', {
      p_transaction_id: transactionId,
      p_rejection_reason: rejectionReason,
    });

    if (error) {
      logger.error('[wallet] rejectWalletTransaction failed', {
        transactionId,
        rejectionReason,
        error,
      });
      throw error;
    }

    logger.info('[wallet] Transaction rejected', {
      transactionId,
      rejectionReason,
      result: data[0],
    });

    return data[0]; // Returns {success, message}
  } catch (err) {
    logger.error('[wallet] rejectWalletTransaction exception', {
      transactionId,
      error: err.message,
    });
    throw err;
  }
}

/**
 * Create admin-initiated withdrawal for a tester
 * @param {string} testerId - Tester user ID
 * @param {number} amountUsd - Amount in USD
 * @param {string} reason - Reason for withdrawal
 * @returns {Promise<{success: boolean, transaction_id: string, message: string}>}
 */
export async function createAdminWithdrawal(testerId, amountUsd, reason) {
  try {
    const { data, error } = await supabase.rpc('create_admin_withdrawal', {
      p_tester_id: testerId,
      p_amount_usd: amountUsd,
      p_reason: reason,
    });

    if (error) {
      logger.error('[wallet] createAdminWithdrawal failed', {
        testerId,
        amountUsd,
        reason,
        error,
      });
      throw error;
    }

    logger.info('[wallet] Admin withdrawal created', {
      testerId,
      amountUsd,
      reason,
      transactionId: data[0].transaction_id,
    });

    return data[0]; // Returns {success, transaction_id, message}
  } catch (err) {
    logger.error('[wallet] createAdminWithdrawal exception', {
      testerId,
      amountUsd,
      error: err.message,
    });
    throw err;
  }
}

/**
 * Set USD to ZMW exchange rate (admin only)
 * @param {number} rateUsdToZmw - Exchange rate
 * @param {string} adminUserId - Admin user ID setting the rate
 * @returns {Promise<object>} - Exchange rate record
 */
export async function setExchangeRate(rateUsdToZmw, adminUserId) {
  try {
    const { data, error } = await supabase
      .from('admin_exchange_rates')
      .insert([
        {
          rate_usd_to_zmw: rateUsdToZmw,
          set_by: adminUserId,
          effective_at: new Date().toISOString(),
        },
      ])
      .select('id, rate_usd_to_zmw, effective_at, created_at');

    if (error) {
      logger.error('[wallet] setExchangeRate failed', { rateUsdToZmw, adminUserId, error });
      throw error;
    }

    logger.info('[wallet] Exchange rate updated', {
      rateUsdToZmw,
      adminUserId,
      recordId: data[0].id,
    });

    return data[0];
  } catch (err) {
    logger.error('[wallet] setExchangeRate exception', {
      rateUsdToZmw,
      adminUserId,
      error: err.message,
    });
    throw err;
  }
}

/**
 * Get all wallet transactions (admin only)
 * @param {number} limit - Limit per page
 * @param {number} offset - Pagination offset
 * @returns {Promise<{transactions: array, total: number}>}
 */
export async function getAllWalletTransactions(limit = 50, offset = 0) {
  try {
    const { data, error, count } = await supabase
      .from('wallet_transactions')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error('[wallet] getAllWalletTransactions failed', { error });
      throw error;
    }

    return { transactions: data, total: count };
  } catch (err) {
    logger.error('[wallet] getAllWalletTransactions exception', { error: err.message });
    throw err;
  }
}

/**
 * Get audit logs for a transaction (admin only)
 * @param {string} transactionId - Transaction ID
 * @returns {Promise<array>} - Audit log records
 */
export async function getTransactionAuditLogs(transactionId) {
  try {
    const { data, error } = await supabase
      .from('transaction_audit_logs')
      .select('*')
      .eq('wallet_transaction_id', transactionId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('[wallet] getTransactionAuditLogs failed', { transactionId, error });
      throw error;
    }

    return data;
  } catch (err) {
    logger.error('[wallet] getTransactionAuditLogs exception', {
      transactionId,
      error: err.message,
    });
    throw err;
  }
}

/**
 * Get pending transactions for admin review
 * @param {number} limit - Limit per page
 * @param {number} offset - Pagination offset
 * @returns {Promise<{transactions: array, total: number}>}
 */
export async function getPendingTransactions(limit = 50, offset = 0) {
  try {
    const { data, error, count } = await supabase
      .from('wallet_transactions')
      .select('*', { count: 'exact' })
      .eq('approval_status', 'requested')
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error('[wallet] getPendingTransactions failed', { error });
      throw error;
    }

    return { transactions: data, total: count };
  } catch (err) {
    logger.error('[wallet] getPendingTransactions exception', { error: err.message });
    throw err;
  }
}

const wallet = {
  getClientIpFromRequest,
  getWalletBalance,
  getExchangeRate,
  checkVelocityLimit,
  recordVelocityTransaction,
  logIPAddress,
  createDepositTransaction,
  createWithdrawalRequest,
  getTransaction,
  getUserWalletTransactions,
  approveWalletTransaction,
  rejectWalletTransaction,
  createAdminWithdrawal,
  setExchangeRate,
  getAllWalletTransactions,
  getTransactionAuditLogs,
  getPendingTransactions,
};

export default wallet;
