/**
 * POST /api/admin/wallet/reject-deposit
 * Admin rejects a pending deposit transaction
 * 
 * Body: { transaction_id: string, rejection_reason: string }
 * Returns: { success: boolean, message: string, error?: string }
 */

import { createClient } from '@/lib/supabase/server';
import { rejectWalletTransaction } from '@/lib/wallet';
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

    // ─── AUTHORIZATION: ADMIN ONLY ───
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      logger.warn('[admin-reject-deposit] Non-admin attempted action', {
        userId: user.id,
      });
      return Response.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    // ─── VALIDATION ───
    const { transaction_id, rejection_reason } = await req.json();

    if (!transaction_id || !rejection_reason) {
      return Response.json(
        { success: false, error: 'Transaction ID and rejection reason required' },
        { status: 400 }
      );
    }

    if (rejection_reason.trim().length < 5) {
      return Response.json(
        { success: false, error: 'Rejection reason must be at least 5 characters' },
        { status: 400 }
      );
    }

    // ─── REJECT TRANSACTION ───
    const result = await rejectWalletTransaction(transaction_id, rejection_reason);

    if (!result.success) {
      logger.warn('[admin-reject-deposit] Rejection failed', {
        adminId: user.id,
        transactionId: transaction_id,
        message: result.message,
      });
      return Response.json(
        { success: false, error: result.message },
        { status: 400 }
      );
    }

    logger.info('[admin-reject-deposit] Deposit rejected', {
      adminId: user.id,
      transactionId: transaction_id,
      reason: rejection_reason,
    });

    return Response.json({
      success: true,
      message: result.message,
      transaction_id,
    });
  } catch (error) {
    logger.error('[admin-reject-deposit] Error', { error: error.message });

    return Response.json(
      { success: false, error: 'Failed to reject deposit' },
      { status: 500 }
    );
  }
}
