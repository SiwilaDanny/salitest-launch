/**
 * GET /api/admin/wallet/transactions
 * Admin views all wallet transactions with filtering options
 * 
 * Query: { 
 *   page?: number (default 1),
 *   limit?: number (default 50),
 *   type?: 'deposit' | 'withdrawal',
 *   status?: 'pending' | 'completed' | 'failed' | 'refunded',
 *   approval_status?: 'requested' | 'approved' | 'rejected',
 *   user_id?: string,
 *   sort?: 'newest' | 'oldest' (default 'newest')
 * }
 * Returns: { success: boolean, transactions: array, total: number, page: number, pages: number, error?: string }
 */

import { createClient } from '@/lib/supabase/server';
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

    // ─── AUTHORIZATION: ADMIN ONLY ───
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      logger.warn('[admin-wallet-transactions] Non-admin attempted access', {
        userId: user.id,
      });
      return Response.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    // ─── QUERY PARAMETERS ───
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(10, parseInt(searchParams.get('limit')) || 50));
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const approval_status = searchParams.get('approval_status');
    const user_id = searchParams.get('user_id');
    const sort = searchParams.get('sort') || 'newest';

    const offset = (page - 1) * limit;

    // ─── BUILD QUERY ───
    let query = supabase
      .from('wallet_transactions')
      .select('*, profiles!wallet_transactions_user_id_fkey(email, full_name, role)', {
        count: 'exact',
      });

    // Apply filters
    if (type) query = query.eq('type', type);
    if (status) query = query.eq('status', status);
    if (approval_status) query = query.eq('approval_status', approval_status);
    if (user_id) query = query.eq('user_id', user_id);

    // Apply sorting
    const ascending = sort === 'oldest';
    query = query.order('created_at', { ascending });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    // ─── EXECUTE QUERY ───
    const { data, error, count } = await query;

    if (error) {
      logger.error('[admin-wallet-transactions] Query failed', { error });
      throw error;
    }

    const pages = Math.ceil((count || 0) / limit);

    logger.info('[admin-wallet-transactions] Retrieved', {
      adminId: user.id,
      count: data.length,
      total: count,
      page,
    });

    return Response.json({
      success: true,
      transactions: data.map((tx) => ({
        id: tx.id,
        user_id: tx.user_id,
        user: tx.profiles,
        type: tx.type,
        amount_usd: parseFloat(tx.amount_usd),
        amount_zmw: parseFloat(tx.amount_zmw),
        status: tx.status,
        approval_status: tx.approval_status,
        approved_by: tx.approved_by,
        approved_at: tx.approved_at,
        approval_reason: tx.approval_reason,
        rejection_reason: tx.rejection_reason,
        lenco_reference: tx.lenco_reference,
        initiated_by_admin: tx.initiated_by_admin,
        created_at: tx.created_at,
        updated_at: tx.updated_at,
      })),
      total: count || 0,
      page,
      pages,
    });
  } catch (error) {
    logger.error('[admin-wallet-transactions] Error', { error: error.message });

    return Response.json(
      { success: false, error: 'Failed to retrieve transactions' },
      { status: 500 }
    );
  }
}
