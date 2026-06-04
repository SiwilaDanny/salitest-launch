import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { validateWebhookSignature } from "@/lib/lenco";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    // 1. Read Raw Body for Signature Validation
    const rawBuffer = await request.arrayBuffer();
    const rawBodyBuffer = Buffer.from(rawBuffer);
    const signature = request.headers.get("x-lenco-signature") || "";

    if (!validateWebhookSignature(rawBodyBuffer, signature)) {
      console.error("[Lenco Webhook] Invalid signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // 2. Parse JSON
    const payloadStr = rawBodyBuffer.toString("utf8");
    const payload = JSON.parse(payloadStr);
    const event = payload.event;
    
    // 3. Extract Data
    const data = payload.data || payload;
    const reference = data.reference;

    if (!reference) {
      return NextResponse.json({ error: "Missing reference" }, { status: 400 });
    }

    // Determine event outcome
    const isSuccess = event === "collection.successful" || 
                      event === "transaction.successful" ||
                      event === "payout.successful" ||
                      payload.status === "successful" ||
                      payload?.data?.status === "successful" ||
                      payload.status === true;

    const isFailed = event === "collection.failed" || 
                     event === "payout.failed" ||
                     event === "transaction.failed" ||
                     payload.status === "failed" ||
                     payload?.data?.status === "failed" ||
                     payload.status === false;

    // Ignore events that are neither success nor failure (e.g. pending, processing)
    if (!isSuccess && !isFailed) {
      console.log(`[Lenco Webhook] Ignored non-terminal event: ${event || payload.status}`);
      return NextResponse.json({ received: true });
    }

    // 4. Find Transaction in both tables
    let tx = null;
    let isWalletTx = false;

    // Search standard transactions table first
    const { data: standardTx } = await supabaseAdmin
      .from("transactions")
      .select("*")
      .eq("lenco_reference", reference)
      .maybeSingle();

    if (standardTx) {
      tx = standardTx;
    } else {
      // Search wallet transactions table
      const { data: walletTx } = await supabaseAdmin
        .from("wallet_transactions")
        .select("*")
        .or(`id.eq.${reference},lenco_reference.eq.${reference}`)
        .maybeSingle();

      if (walletTx) {
        tx = walletTx;
        isWalletTx = true;
      }
    }

    if (!tx) {
      console.error("[Lenco Webhook] Transaction not found for reference:", reference);
      return NextResponse.json({ received: true }); // Acknowledge anyway
    }

    // ─── HANDLE FAILURE ───
    if (isFailed) {
      if (tx.status !== "failed") {
        await supabaseAdmin
          .from(isWalletTx ? "wallet_transactions" : "transactions")
          .update({ 
            status: "failed",
            ...(isWalletTx ? { approval_status: "rejected" } : {})
          })
          .eq("id", tx.id);
        console.log(`[Lenco Webhook] Marked ${isWalletTx ? "wallet_transaction" : "transaction"} ${tx.id} as failed`);
      }
      return NextResponse.json({ success: true });
    }

    // ─── HANDLE SUCCESS ───
    // Prevent double processing
    if (tx.status === "completed") {
      return NextResponse.json({ received: true });
    }

    // 5. Update Transaction to Completed
    if (isWalletTx) {
      if (tx.type === "deposit") {
        // For deposits, the webhook only confirms receipt of payment by setting status = 'completed'.
        // The funds are NOT credited until the admin approves/verifies it from the approvals dashboard.
        await supabaseAdmin
          .from("wallet_transactions")
          .update({ 
            status: "completed"
          })
          .eq("id", tx.id);
      } else if (tx.type === "withdrawal") {
        // For withdrawals, the admin already approved it (and balance was debited), so we mark status = 'completed'
        await supabaseAdmin
          .from("wallet_transactions")
          .update({ 
            status: "completed"
          })
          .eq("id", tx.id);
      }
    } else {
      // Standard transactions
      await supabaseAdmin
        .from("transactions")
        .update({ status: "completed" })
        .eq("id", tx.id);

      // 6. Fulfill based on transaction type
      if (tx.type === "campaign_payment" && tx.campaign_id) {
        // Mark campaign as funded and active
        await supabaseAdmin
          .from("campaigns")
          .update({ status: "recruiting" })
          .eq("id", tx.campaign_id);
      } 
      else if (tx.type === "tester_payout" && tx.enrollment_id) {
        // Mark enrollment as paid
        await supabaseAdmin
          .from("enrollments")
          .update({ reward_paid: true })
          .eq("id", tx.enrollment_id);
      }
    }

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error("[Lenco Webhook] Error processing webhook:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
