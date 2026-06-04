/**
 * POST /api/admin/wallet/initiate-withdrawal
 * Admin creates a withdrawal for a tester (admin-initiated)
 * 
 * Body: { tester_id: string, amount_usd: number, reason: string }
 * Returns: { success: boolean, transaction_id: string, message: string, error?: string }
 */

import { createClient } from '@/lib/supabase/server';
import { createAdminWithdrawal } from '@/lib/wallet';
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
      logger.warn('[admin-initiate-withdrawal] Non-admin attempted action', {
        userId: user.id,
      });
      return Response.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    // ─── VALIDATION ───
    const { tester_id, amount_usd, reason } = await req.json();

    if (!tester_id || !amount_usd || !reason) {
      return Response.json(
        { success: false, error: 'Tester ID, amount, and reason are required' },
        { status: 400 }
      );
    }

    if (typeof amount_usd !== 'number' || amount_usd <= 0) {
      return Response.json(
        { success: false, error: 'Invalid amount' },
        { status: 400 }
      );
    }

    if (reason.trim().length < 5) {
      return Response.json(
        { success: false, error: 'Reason must be at least 5 characters' },
        { status: 400 }
      );
    }

    // ─── CREATE ADMIN WITHDRAWAL ───
    const result = await createAdminWithdrawal(tester_id, amount_usd, reason);

    if (!result.success) {
      logger.warn('[admin-initiate-withdrawal] Creation failed', {
        adminId: user.id,
        testerId: tester_id,
        amount_usd,
        message: result.message,
      });
      return Response.json(
        { success: false, error: result.message },
        { status: 400 }
      );
    }

    logger.info('[admin-initiate-withdrawal] Withdrawal created', {
      adminId: user.id,
      testerId: tester_id,
      transactionId: result.transaction_id,
      amount_usd,
      reason,
    });

    return Response.json({
      success: true,
      transaction_id: result.transaction_id,
      message: result.message,
    });
  } catch (error) {
    logger.error('[admin-initiate-withdrawal] Error', { error: error.message });

    return Response.json(
      { success: false, error: 'Failed to create withdrawal' },
      { status: 500 }
    );
  }
}
