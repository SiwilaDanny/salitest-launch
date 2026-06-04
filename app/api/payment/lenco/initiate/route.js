import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { initiateMobileMoneyPayment, generateReference } from "@/lib/lenco";
import { getExchangeRate } from "@/lib/wallet";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const authHeader = request.headers.get("authorization");
    let developer_id = null;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      // Allow API key usage if needed, but for dashboard UI we use standard session
      const token = authHeader.split(" ")[1];
      const { data: user, error } = await supabaseAdmin.auth.getUser(token);
      if (!error && user) {
        developer_id = user.user.id;
      }
    }

    // If no auth header, try to extract from body or expect standard Supabase session
    const body = await request.json();
    const { campaign_id, phone, operator, user_id } = body;
    
    // Fallback to user_id from body if auth header not used (relies on RLS for security in a real app)
    const effectiveUserId = developer_id || user_id;

    if (!effectiveUserId || !campaign_id || !phone || !operator) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1. Verify campaign belongs to user and is pending
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from("campaigns")
      .select("id, budget_total, status")
      .eq("id", campaign_id)
      .eq("developer_id", effectiveUserId)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    if (campaign.status !== "pending") {
      return NextResponse.json({ error: "Campaign is already funded or active" }, { status: 400 });
    }

    // Calculate total including 15% platform fee (in USD)
    const usdTotal = Number((campaign.budget_total * 1.15).toFixed(2));
    
    // Convert to ZMW using admin-set exchange rate
    const exchangeRate = await getExchangeRate();
    const zmwTotal = Number((usdTotal * exchangeRate).toFixed(2));
    
    const reference = generateReference("SALI-CAMPAIGN");

    // 2. Initiate Lenco Payment (amount in ZMW)
    const lencoResponse = await initiateMobileMoneyPayment({
      amount: zmwTotal,
      phone,
      operator,
      reference,
    });

    if (lencoResponse.status === "failed") {
      throw new Error("Lenco rejected the payment initiation");
    }

    // 3. Log pending transaction
    const { error: txError } = await supabaseAdmin
      .from("transactions")
      .insert({
        user_id: effectiveUserId,
        campaign_id: campaign.id,
        type: "campaign_payment",
        amount: zmwTotal,
        currency: "ZMW",
        lenco_reference: reference,
        status: "pending"
      });

    if (txError) {
      console.error("Failed to log transaction:", txError);
      // We still return success to frontend because Lenco prompt is already sent to user's phone
    }

    return NextResponse.json({ 
      success: true, 
      reference,
      message: "Please check your phone for the USSD prompt to complete the payment."
    });

  } catch (err) {
    console.error("Lenco Initiate Error:", err);
    return NextResponse.json({ error: err.message || "Failed to initiate payment" }, { status: 500 });
  }
}
