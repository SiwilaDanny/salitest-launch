/**
 * POST /api/admin/exchange-rate/set
 * Admin sets the USD to ZMW exchange rate
 * 
 * Body: { rate_usd_to_zmw: number }
 * Returns: { success: boolean, rate: number, effective_at: string, error?: string }
 */

import { createClient } from '@/lib/supabase/server';
import { setExchangeRate } from '@/lib/wallet';
import logger from '@/lib/logger';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return Response.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return Response.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    const { data, error } = await supabase
      .from('admin_exchange_rates')
      .select('id, rate_usd_to_zmw, set_by, effective_at, created_at, profiles!admin_exchange_rates_set_by_fkey(email, full_name)')
      .lte('effective_at', new Date().toISOString())
      .order('effective_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    const rates = data || [];
    const current = rates[0] || null;

    return Response.json({
      success: true,
      current_rate: current ? parseFloat(current.rate_usd_to_zmw) : 26.0,
      current,
      history: rates,
    });
  } catch (error) {
    logger.error('[admin-exchange-rate] Fetch error', { error: error.message });

    return Response.json(
      { success: false, error: 'Failed to fetch exchange rates' },
      { status: 500 }
    );
  }
}

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
      logger.warn('[admin-exchange-rate] Non-admin attempted action', {
        userId: user.id,
      });
      return Response.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    // ─── VALIDATION ───
    const { rate_usd_to_zmw } = await req.json();

    if (!rate_usd_to_zmw || typeof rate_usd_to_zmw !== 'number') {
      return Response.json(
        { success: false, error: 'Valid exchange rate required' },
        { status: 400 }
      );
    }

    if (rate_usd_to_zmw <= 0 || rate_usd_to_zmw > 1000) {
      return Response.json(
        { success: false, error: 'Exchange rate must be between 0.01 and 1000' },
        { status: 400 }
      );
    }

    // ─── SET EXCHANGE RATE ───
    const result = await setExchangeRate(rate_usd_to_zmw, user.id);

    logger.info('[admin-exchange-rate] Rate updated', {
      adminId: user.id,
      rate_usd_to_zmw,
      recordId: result.id,
    });

    return Response.json({
      success: true,
      rate: parseFloat(result.rate_usd_to_zmw),
      effective_at: result.effective_at,
      message: `Exchange rate set to 1 USD = ${parseFloat(result.rate_usd_to_zmw).toFixed(2)} ZMW`,
    });
  } catch (error) {
    logger.error('[admin-exchange-rate] Error', { error: error.message });

    return Response.json(
      { success: false, error: 'Failed to set exchange rate' },
      { status: 500 }
    );
  }
}
