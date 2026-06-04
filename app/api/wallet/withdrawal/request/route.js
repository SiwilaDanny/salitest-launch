/**
 * POST /api/wallet/withdrawal/request
 * Tester requests a withdrawal of funds from their wallet
 * 
 * Body: { amount_usd: number }
 * Returns: { success: boolean, transaction_id: string, error?: string }
 */

import { createClient } from '@/lib/supabase/server';
import {
  createWithdrawalRequest,
  checkVelocityLimit,
  getClientIpFromRequest,
  recordVelocityTransaction,
} from '@/lib/wallet';
import logger from '@/lib/logger';

export async function POST(req) {
  try {
    // ─── AUTHENTICATION ───
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return Response.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = user.id;

    // ─── VERIFY USER IS TESTER OR ADMIN ───
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (profile?.role !== 'tester' && profile?.role !== 'admin') {
      logger.warn('[withdrawal] Unauthorized role attempted withdrawal', { userId, role: profile?.role });
      return Response.json(
        { success: false, error: 'Only testers (or admins) can request withdrawals' },
        { status: 403 }
      );
    }

    // ─── VALIDATION ───
    const { amount_usd, phone, operator } = await req.json();

    if (!amount_usd || typeof amount_usd !== 'number' || amount_usd <= 0) {
      return Response.json(
        { success: false, error: 'Invalid amount' },
        { status: 400 }
      );
    }

    if (!phone || !operator) {
      return Response.json(
        { success: false, error: 'Phone number and operator are required' },
        { status: 400 }
      );
    }

    // Reasonable limits
    if (amount_usd < 1 || amount_usd > 50000) {
      return Response.json(
        { success: false, error: 'Amount must be between $1 and $50,000 USD' },
        { status: 400 }
      );
    }

    // ─── SECURITY: VELOCITY CHECK ───
    const velocityCheck = await checkVelocityLimit(
      userId,
      'withdrawal',
      3, // Max 3 withdrawal requests per hour
      20 // Max 20 per day
    );

    if (!velocityCheck.allowed) {
      logger.warn('[withdrawal] Velocity limit exceeded', {
        userId,
        amount_usd,
        reason: velocityCheck.reason,
      });
      return Response.json(
        {
          success: false,
          error: velocityCheck.reason || 'Too many withdrawal requests. Please try again later.',
        },
        { status: 429 }
      );
    }

    // ─── IP LOGGING ───
    const ipAddress = getClientIpFromRequest(req);
    const userAgent = req.headers.get('user-agent') || 'unknown';

    // ─── CREATE WITHDRAWAL REQUEST ───
    const transaction = await createWithdrawalRequest(userId, amount_usd, ipAddress, userAgent, phone, operator);

    // Record velocity transaction
    await recordVelocityTransaction(userId, 'withdrawal');

    logger.info('[withdrawal] Request created', {
      userId,
      transactionId: transaction.id,
      amount_usd,
    });

    return Response.json({
      success: true,
      transaction_id: transaction.id,
      status: transaction.status,
      approval_status: transaction.approval_status,
      amount_usd: transaction.amount_usd,
      amount_zmw: transaction.amount_zmw,
      message:
        'Withdrawal request submitted. Your request has been sent for admin approval. You will be notified when it is processed.',
    });
  } catch (error) {
    logger.error('[withdrawal] Error', { error: error.message, stack: error.stack });

    return Response.json(
      { success: false, error: 'Failed to create withdrawal request' },
      { status: 500 }
    );
  }
}
