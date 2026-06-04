import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      fingerprint,
      deviceName,
      os,
      browser,
      screenResolution,
      isEmulator,
      isBot
    } = await request.json();

    if (!fingerprint) {
      return NextResponse.json({ error: "Missing fingerprint" }, { status: 400 });
    }

    // Try to get client IP and geographic location from headers
    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || null;
    const geoCountry = request.headers.get("x-vercel-ip-country") || null;

    // Upsert the device registration
    const { error } = await supabase
      .from("tester_devices")
      .upsert({
        tester_id: user.id,
        device_fingerprint: fingerprint,
        device_name: deviceName,
        os,
        browser,
        screen_resolution: screenResolution,
        ip_address: ipAddress,
        geo_country: geoCountry,
        is_emulator: isEmulator || false,
        is_bot: isBot || false,
        last_seen_at: new Date().toISOString()
      }, {
        onConflict: "tester_id,device_fingerprint"
      });

    if (error) {
      console.error("[Device Registration] DB Error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Device Registration] API Crash:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
