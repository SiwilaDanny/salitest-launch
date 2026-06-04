/**
 * GET /api/wallet/deposit/status?transactionId=uuid
 * Check the status of a deposit transaction
 * 
 * Query: { transactionId: string }
 * Returns: { success: boolean, transaction: object, error?: string }
 */

import { createClient } from '@/lib/supabase/server';
import { getTransaction } from '@/lib/wallet';
import logger from '@/lib/logger';

export async function GET(req) {
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
    const { searchParams } = new URL(req.url);
    const transactionId = searchParams.get('transactionId');

    if (!transactionId) {
      return Response.json(
        { success: false, error: 'Transaction ID required' },
        { status: 400 }
      );
    }

    // ─── GET TRANSACTION ───
    const transaction = await getTransaction(transactionId);

    if (!transaction) {
      return Response.json(
        { success: false, error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // ─── AUTHORIZATION: USER CAN ONLY SEE OWN TRANSACTIONS ───
    if (transaction.user_id !== userId) {
      logger.warn('[deposit-status] Unauthorized access attempt', {
        userId,
        transactionId,
        ownerUserId: transaction.user_id,
      });
      return Response.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // ─── RETURN TRANSACTION STATUS ───
    logger.info('[deposit-status] Retrieved', {
      userId,
      transactionId,
      status: transaction.status,
    });

    return Response.json({
      success: true,
      transaction: {
        id: transaction.id,
        type: transaction.type,
        amount_usd: parseFloat(transaction.amount_usd),
        amount_zmw: parseFloat(transaction.amount_zmw),
        status: transaction.status,
        approval_status: transaction.approval_status,
        lenco_reference: transaction.lenco_reference,
        approved_at: transaction.approved_at,
        approval_reason: transaction.approval_reason,
        rejection_reason: transaction.rejection_reason,
        created_at: transaction.created_at,
      },
    });
  } catch (error) {
    logger.error('[deposit-status] Error', { error: error.message });

    return Response.json(
      { success: false, error: 'Failed to retrieve transaction status' },
      { status: 500 }
    );
  }
}
