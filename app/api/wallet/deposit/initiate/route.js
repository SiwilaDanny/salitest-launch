/**
 * POST /api/wallet/deposit/initiate
 * User initiates a deposit via Lenco mobile money
 * 
 * Body: { amount_usd: number }
 * Returns: { success: boolean, transaction_id: string, lenco_url?: string, error?: string }
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import {
  createDepositTransaction,
  checkVelocityLimit,
  getClientIpFromRequest,
  recordVelocityTransaction,
} from '@/lib/wallet';
import { initiateMobileMoneyPayment } from '@/lib/lenco';
import logger from '@/lib/logger';

const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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
    if (amount_usd < 1 || amount_usd > 10000) {
      return Response.json(
        { success: false, error: 'Amount must be between $1 and $10,000 USD' },
        { status: 400 }
      );
    }

    // ─── SECURITY: VELOCITY CHECK ───
    const velocityCheck = await checkVelocityLimit(
      userId,
      'deposit',
      5, // Max 5 deposits per hour
      50 // Max 50 per day
    );

    if (!velocityCheck.allowed) {
      logger.warn('[deposit] Velocity limit exceeded', {
        userId,
        amount_usd,
        reason: velocityCheck.reason,
      });
      return Response.json(
        {
          success: false,
          error: velocityCheck.reason || 'Too many deposit attempts. Please try again later.',
        },
        { status: 429 }
      );
    }

    // ─── IP LOGGING ───
    const ipAddress = getClientIpFromRequest(req);
    const userAgent = req.headers.get('user-agent') || 'unknown';

    // ─── CREATE TRANSACTION ───
    const transaction = await createDepositTransaction(userId, amount_usd, ipAddress, userAgent, phone, operator);

    logger.info('[deposit] Transaction created', {
      userId,
      transactionId: transaction.id,
      amount_usd,
    });

    // ─── INITIATE LENCO PAYMENT ───
    try {
      // Note: This will send USSD prompt to user's phone
      // The webhook will handle payment confirmation
      const lencoResponse = await initiateMobileMoneyPayment({
        amount: transaction.amount_zmw,
        phone,
        operator,
        reference: transaction.id,
      });

      if (!lencoResponse.success) {
        // Mark transaction as failed
        await supabaseAdmin
          .from('wallet_transactions')
          .update({ status: 'failed' })
          .eq('id', transaction.id);

        logger.error('[deposit] Lenco payment initiation failed', {
          userId,
          transactionId: transaction.id,
          lencoError: lencoResponse.error,
        });

        return Response.json(
          {
            success: false,
            error: 'Failed to initiate payment. Please try again.',
            transactionId: transaction.id,
          },
          { status: 500 }
        );
      }

      // Update transaction with Lenco reference
      await supabaseAdmin
        .from('wallet_transactions')
        .update({ lenco_reference: lencoResponse.reference })
        .eq('id', transaction.id);

      // Record velocity transaction
      await recordVelocityTransaction(userId, 'deposit');

      logger.info('[deposit] Lenco payment initiated', {
        userId,
        transactionId: transaction.id,
        lencoReference: lencoResponse.reference,
      });

      return Response.json({
        success: true,
        transaction_id: transaction.id,
        status: transaction.status,
        approval_status: transaction.approval_status,
        amount_usd: transaction.amount_usd,
        amount_zmw: transaction.amount_zmw,
        message:
          'Deposit initiated. You will receive a payment prompt on your registered phone number. Please complete the payment to proceed with approval.',
      });
    } catch (lencoError) {
      logger.error('[deposit] Lenco integration error', {
        userId,
        transactionId: transaction.id,
        error: lencoError.message,
      });

      return Response.json(
        {
          success: false,
          error: 'Payment service temporarily unavailable. Please try again.',
          transactionId: transaction.id,
        },
        { status: 503 }
      );
    }
  } catch (error) {
    logger.error('[deposit] Unhandled error', { error: error.message, stack: error.stack });

    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
