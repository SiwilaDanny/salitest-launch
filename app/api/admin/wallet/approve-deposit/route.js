/**
 * POST /api/admin/wallet/approve-deposit
 * Admin approves a pending deposit transaction
 * 
 * Body: { transaction_id: string, approval_reason?: string }
 * Returns: { success: boolean, message: string, error?: string }
 */

import { createClient } from '@/lib/supabase/server';
import { approveWalletTransaction } from '@/lib/wallet';
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
      logger.warn('[admin-approve-deposit] Non-admin attempted action', {
        userId: user.id,
      });
      return Response.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    // ─── VALIDATION ───
    const { transaction_id, approval_reason } = await req.json();

    if (!transaction_id) {
      return Response.json(
        { success: false, error: 'Transaction ID required' },
        { status: 400 }
      );
    }

    // ─── APPROVE TRANSACTION ───
    const result = await approveWalletTransaction(transaction_id, approval_reason, supabase);

    if (!result.success) {
      logger.warn('[admin-approve-deposit] Approval failed', {
        adminId: user.id,
        transactionId: transaction_id,
        message: result.message,
      });
      return Response.json(
        { success: false, error: result.message },
        { status: 400 }
      );
    }

    logger.info('[admin-approve-deposit] Deposit approved', {
      adminId: user.id,
      transactionId: transaction_id,
      reason: approval_reason,
    });

    return Response.json({
      success: true,
      message: result.message,
      transaction_id,
    });
  } catch (error) {
    logger.error('[admin-approve-deposit] Error', { error: error.message });

    return Response.json(
      { success: false, error: 'Failed to approve deposit' },
      { status: 500 }
    );
  }
}
