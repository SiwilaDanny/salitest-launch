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

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.user.id)
      .single();

    if (profileError || !profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

    const body = await request.json();
    const { transaction_id } = body;
    if (!transaction_id) {
      return NextResponse.json({ error: "Missing transaction_id." }, { status: 400 });
    }

    const { data: transaction, error: txFetchError } = await supabaseAdmin
      .from("transactions")
      .select("*")
      .eq("id", transaction_id)
      .eq("type", "tester_payout")
      .eq("approval_status", "requested")
      .single();

    if (txFetchError || !transaction) {
      return NextResponse.json({ error: "Payout request not found or already processed." }, { status: 404 });
    }

    const { error: updateError } = await supabaseAdmin
      .from("transactions")
      .update({
        approval_status: "rejected",
        status: "failed",
      })
      .eq("id", transaction_id);

    if (updateError) {
      console.error("Failed to reject payout request:", updateError);
      return NextResponse.json({ error: "Failed to reject payout request." }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Payout request rejected." });
  } catch (err) {
    console.error("Admin payout rejection error:", err);
    return NextResponse.json({ error: err.message || "Failed to reject payout." }, { status: 500 });
  }
}
