/**
 * GET /api/wallet/balance
 * Get user's wallet balance
 * 
 * Returns: { success: boolean, balance_usd: number, balance_zmw: number, total_deposited_usd: number, total_withdrawn_usd: number, error?: string }
 */

import { createClient } from '@/lib/supabase/server';
import { getWalletBalance } from '@/lib/wallet';
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

    // ─── GET WALLET ───
    const wallet = await getWalletBalance(userId);

    logger.info('[wallet-balance] Retrieved', {
      userId,
      balance_usd: wallet.balance_usd,
    });

    return Response.json({
      success: true,
      balance_usd: parseFloat(wallet.balance_usd),
      balance_zmw: parseFloat(wallet.balance_zmw),
      total_deposited_usd: parseFloat(wallet.total_deposited_usd),
      total_withdrawn_usd: parseFloat(wallet.total_withdrawn_usd),
      updated_at: wallet.updated_at,
    });
  } catch (error) {
    logger.error('[wallet-balance] Error', { error: error.message });

    return Response.json(
      { success: false, error: 'Failed to retrieve wallet balance' },
      { status: 500 }
    );
  }
}
