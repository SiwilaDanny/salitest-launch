import { createClient } from '@/lib/supabase/server';
import { verifyTOTP } from '@/lib/totp';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Verify user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, totp_secret')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { campaignId, status, token } = await req.json();

    if (!campaignId || !status) {
      return Response.json({ error: 'Campaign ID and target status are required' }, { status: 400 });
    }

    // 2. Enforce 2FA verification if configured
    if (!profile.totp_secret) {
      return Response.json({ 
        error: '2FA_NOT_CONFIGURED', 
        message: 'Google Authenticator 2FA is required for admin verifications. Please configure it first.' 
      }, { status: 400 });
    }

    if (!token) {
      return Response.json({ error: 'Google Authenticator 2FA verification code is required.' }, { status: 400 });
    }

    // Verify token
    const isValid = verifyTOTP(profile.totp_secret, token);
    if (!isValid) {
      return Response.json({ error: 'Invalid Google Authenticator code. Please try again.' }, { status: 400 });
    }

    // 3. Update campaign status
    const { error: updateErr } = await supabase
      .from('campaigns')
      .update({ 
        status: status, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', campaignId);

    if (updateErr) {
      console.error('[Admin Campaign Status] Database update error:', updateErr);
      return Response.json({ error: 'Failed to update campaign status' }, { status: 500 });
    }

    return Response.json({ success: true, message: `Campaign status updated to "${status}" successfully.` });
  } catch (err) {
    console.error('[Admin Campaign Status] Error:', err);
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
