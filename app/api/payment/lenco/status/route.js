import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyPayment } from "@/lib/lenco";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const dynamic = "force-dynamic";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const reference = searchParams.get("reference");

  if (!reference) {
    return NextResponse.json({ error: "Missing reference" }, { status: 400 });
  }

  try {
    // 1. Check local DB first
    let tx = null;
    let isWalletTx = false;

    // Search standard transactions table first
    const { data: standardTx } = await supabaseAdmin
      .from("transactions")
      .select("status, campaign_id, type")
      .eq("lenco_reference", reference)
      .maybeSingle();

    if (standardTx) {
      tx = standardTx;
    } else {
      // Search wallet transactions table
      const { data: walletTx } = await supabaseAdmin
        .from("wallet_transactions")
        .select("id, status, type, user_id, amount_usd")
        .or(`id.eq.${reference},lenco_reference.eq.${reference}`)
        .maybeSingle();

      if (walletTx) {
        tx = walletTx;
        isWalletTx = true;
      }
    }

    if (!tx) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    if (tx.status === "completed") {
      return NextResponse.json({ status: "completed" });
    }

    // 2. Active Polling Fallback: If still pending locally, check with Lenco directly
    try {
      const lencoStatus = await verifyPayment(reference);
      
      const isSuccess = lencoStatus.status === "successful" || 
                        lencoStatus.data?.status === "successful";

      if (isSuccess) {
        // Fulfill since webhook probably failed
        if (isWalletTx) {
          if (tx.type === "deposit") {
            // Webhook/polling only confirms receipt of payment by setting status = 'completed'.
            // The funds are NOT credited until the admin approves/verifies it.
            await supabaseAdmin
              .from("wallet_transactions")
              .update({ 
                status: "completed"
              })
              .eq("id", tx.id);
          } else if (tx.type === "withdrawal") {
            // For withdrawals, the admin already approved it, so we mark status = 'completed'
            await supabaseAdmin
              .from("wallet_transactions")
              .update({ 
                status: "completed"
              })
              .eq("id", tx.id);
          }
        } else {
          await supabaseAdmin
            .from("transactions")
            .update({ status: "completed" })
            .eq("lenco_reference", reference);

          if (tx.type === "campaign_payment" && tx.campaign_id) {
            await supabaseAdmin
              .from("campaigns")
              .update({ status: "recruiting" })
              .eq("id", tx.campaign_id);
          }
        }

        return NextResponse.json({ status: "completed" });
      }
      
      if (lencoStatus.status === "failed" || lencoStatus.data?.status === "failed") {
         await supabaseAdmin
          .from(isWalletTx ? "wallet_transactions" : "transactions")
          .update({ 
            status: "failed",
            ...(isWalletTx ? { approval_status: "rejected" } : {})
          })
          .eq(isWalletTx ? "id" : "lenco_reference", isWalletTx ? tx.id : reference);
         return NextResponse.json({ status: "failed" });
      }
      
    } catch (lencoErr) {
      console.error("Lenco polling error:", lencoErr);
      // Just fall through to return pending
    }

    return NextResponse.json({ status: "pending" });

  } catch (err) {
    console.error("Status check error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
