/**
 * GET /api/admin/audit-logs
 * Admin views immutable transaction approval audit logs
 * 
 * Query: { 
 *   page?: number (default 1),
 *   limit?: number (default 50),
 *   action?: 'approved' | 'rejected' | 'initiated',
 *   admin_id?: string,
 *   transaction_id?: string
 * }
 * Returns: { success: boolean, logs: array, total: number, page: number, pages: number, error?: string }
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
      logger.warn('[admin-audit-logs] Non-admin attempted access', {
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
    const action = searchParams.get('action');
    const admin_id = searchParams.get('admin_id');
    const transaction_id = searchParams.get('transaction_id');

    const offset = (page - 1) * limit;

    // ─── BUILD QUERY ───
    let query = supabase
      .from('transaction_audit_logs')
      .select(
        `*,
        admin:profiles!admin_id(id, email, full_name),
        wallet_transaction:wallet_transactions!wallet_transaction_id(
          id,
          user_id,
          type,
          amount_usd,
          status,
          user:profiles!wallet_transactions_user_id_fkey(id, email, full_name)
        )`,
        { count: 'exact' }
      );

    // Apply filters
    if (action) query = query.eq('action', action);
    if (admin_id) query = query.eq('admin_id', admin_id);
    if (transaction_id) query = query.eq('wallet_transaction_id', transaction_id);

    // Apply sorting (newest first)
    query = query.order('created_at', { ascending: false });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    // ─── EXECUTE QUERY ───
    const { data, error, count } = await query;

    if (error) {
      logger.error('[admin-audit-logs] Query failed', { error });
      throw error;
    }

    const pages = Math.ceil((count || 0) / limit);

    logger.info('[admin-audit-logs] Retrieved', {
      adminId: user.id,
      count: data.length,
      total: count,
      page,
    });

    return Response.json({
      success: true,
      logs: data.map((log) => ({
        id: log.id,
        wallet_transaction_id: log.wallet_transaction_id,
        transaction: log.wallet_transaction,
        admin_id: log.admin_id,
        admin: log.admin,
        action: log.action,
        reason: log.reason,
        ip_address: log.ip_address,
        user_agent: log.user_agent,
        created_at: log.created_at,
      })),
      total: count || 0,
      page,
      pages,
    });
  } catch (error) {
    logger.error('[admin-audit-logs] Error', { error: error.message });

    return Response.json(
      { success: false, error: 'Failed to retrieve audit logs' },
      { status: 500 }
    );
  }
}
