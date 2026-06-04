import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Authorization token required." }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const { data: user, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user?.user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const testerId = user.user.id;
    const body = await request.json();
    const { phone, operator, amount } = body;

    if (!testerId || !phone || !operator || !amount) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role, full_name")
      .eq("id", testerId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    if (profile.role !== "tester") {
      return NextResponse.json({ error: "Only testers may request payouts." }, { status: 403 });
    }

    const { error: txError } = await supabaseAdmin
      .from("transactions")
      .insert({
        user_id: testerId,
        type: "tester_payout",
        amount: Number(amount),
        currency: "ZMW",
        payout_phone: phone,
        payout_operator: operator,
        approval_status: "requested",
        status: "pending"
      });

    if (txError) {
      console.error("Failed to log payout request:", txError);
      return NextResponse.json({ error: "Failed to submit payout request." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Payout request recorded. An administrator will approve it before the transfer is sent.",
    });
  } catch (err) {
    console.error("Tester payout request error:", err);
    return NextResponse.json({ error: err.message || "Failed to request payout." }, { status: 500 });
  }
}
