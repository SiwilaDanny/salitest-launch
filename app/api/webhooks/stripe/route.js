import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Stripe Webhook Handler
 * POST /api/webhooks/stripe
 *
 * Handles:
 *  - checkout.session.completed  → mark campaign as funded
 *  - transfer.created            → mark tester payout completed
 *  - payment_intent.payment_failed → cancel campaign, notify developer
 */
export async function POST(request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  // In production: verify webhook signature
  // const event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET);

  let event;
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const supabase = await createClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const campaignId = session.metadata?.campaign_id;
      if (campaignId) {
        await supabase
          .from("campaigns")
          .update({ status: "recruiting", stripe_payment_id: session.payment_intent })
          .eq("id", campaignId);

        await supabase.from("transactions").insert({
          user_id: session.metadata.developer_id,
          campaign_id: campaignId,
          type: "campaign_payment",
          amount: session.amount_total / 100,
          currency: session.currency.toUpperCase(),
          stripe_payment_id: session.payment_intent,
          status: "completed",
        });
      }
      break;
    }

    case "transfer.created": {
      const transfer = event.data.object;
      const enrollmentId = transfer.metadata?.enrollment_id;
      if (enrollmentId) {
        await supabase
          .from("enrollments")
          .update({ reward_paid: true })
          .eq("id", enrollmentId);

        await supabase.from("transactions").insert({
          user_id: transfer.metadata.tester_id,
          campaign_id: transfer.metadata.campaign_id,
          enrollment_id: enrollmentId,
          type: "tester_payout",
          amount: transfer.amount / 100,
          stripe_transfer_id: transfer.id,
          status: "completed",
        });
      }
      break;
    }

    case "payment_intent.payment_failed": {
      const pi = event.data.object;
      const campaignId = pi.metadata?.campaign_id;
      if (campaignId) {
        await supabase
          .from("campaigns")
          .update({ status: "cancelled" })
          .eq("id", campaignId);
      }
      break;
    }

    default:
      console.log(`Unhandled Stripe event: ${event.type}`);
  }

  return NextResponse.json({ received: true });
}
