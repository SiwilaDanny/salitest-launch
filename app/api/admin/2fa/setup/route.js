import { createClient } from '@/lib/supabase/server';
import { generateSecret, verifyTOTP } from '@/lib/totp';

export const dynamic = 'force-dynamic';

// GET: Generate a new secret and QR code URL
export async function GET(req) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { secret, otpauthUrl } = generateSecret(user.email);
    // Use public secure qr server to generate QR image
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(otpauthUrl)}&size=200x200&ecc=M`;

    return Response.json({ secret, qrCodeUrl });
  } catch (err) {
    console.error('[2FA Setup GET] Error:', err);
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST: Verify token and save secret to database
export async function POST(req) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { secret, token } = await req.json();

    if (!secret || !token) {
      return Response.json({ error: 'Secret and token are required' }, { status: 400 });
    }

    // Validate token
    const isValid = verifyTOTP(secret, token);
    if (!isValid) {
      return Response.json({ error: 'Invalid verification code. Please check your authenticator app.' }, { status: 400 });
    }

    // Save secret to profile
    const { error: updateErr } = await supabase
      .from('profiles')
      .update({ totp_secret: secret })
      .eq('id', user.id);

    if (updateErr) throw updateErr;

    return Response.json({ success: true, message: 'Google Authenticator 2FA set up successfully!' });
  } catch (err) {
    console.error('[2FA Setup POST] Error:', err);
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
