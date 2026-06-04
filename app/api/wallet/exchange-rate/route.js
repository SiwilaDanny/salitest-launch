/**
 * GET /api/wallet/exchange-rate
 * Public-facing endpoint (authenticated users) to fetch the current USD→ZMW rate.
 *
 * Returns: { success: boolean, rate: number, effective_at?: string }
 */

import { createClient } from '@/lib/supabase/server';
import { getExchangeRate } from '@/lib/wallet';
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

    const rate = await getExchangeRate();

    return Response.json({
      success: true,
      rate,
    });
  } catch (error) {
    logger.error('[exchange-rate] Fetch error', { error: error.message });

    return Response.json(
      { success: false, error: 'Failed to fetch exchange rate' },
      { status: 500 }
    );
  }
}
