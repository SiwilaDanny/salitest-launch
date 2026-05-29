import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeTrustScore, getFraudFlags, scoreToSeverity } from "@/lib/fraud/scoring";

/**
 * POST /api/fraud/check
 * Body: { tester_id, device, network, behavior }
 * Returns: { score, recommendation, flags, severity }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { tester_id, device, network, behavior } = body;

    if (!tester_id) {
      return NextResponse.json({ error: "tester_id required" }, { status: 400 });
    }

    const supabase = await createClient();

    // Fetch tester history
    const { data: profile } = await supabase
      .from("profiles")
      .select("trust_score, created_at")
      .eq("id", tester_id)
      .single();

    const { data: enrollments } = await supabase
      .from("enrollments")
      .select("status")
      .eq("tester_id", tester_id);

    const { data: feedbackRows } = await supabase
      .from("feedback")
      .select("quality_score")
      .eq("tester_id", tester_id);

    const accountAgeDays = profile?.created_at
      ? Math.floor((Date.now() - new Date(profile.created_at).getTime()) / 86400000)
      : 0;

    const completedCampaigns = enrollments?.filter((e) => e.status === "completed").length ?? 0;
    const droppedCampaigns = enrollments?.filter((e) => e.status === "dropped").length ?? 0;
    const dropRate = enrollments?.length > 0
      ? droppedCampaigns / enrollments.length
      : 0;

    const avgQualityScore = feedbackRows?.length > 0
      ? feedbackRows.reduce((s, f) => s + (f.quality_score ?? 50), 0) / feedbackRows.length
      : 70;

    const signals = {
      device: device ?? {},
      network: network ?? {},
      behavior: behavior ?? {},
      feedback: { avgQualityScore, totalFeedback: feedbackRows?.length ?? 0, genericCount: 0 },
      history: { accountAgeDays, completedCampaigns, dropRate },
    };

    const { score, breakdown, recommendation } = computeTrustScore(signals);
    const flags = getFraudFlags(signals);
    const severity = scoreToSeverity(score);

    // Persist fraud events for each flag
    if (flags.length > 0) {
      const fraudEvents = flags.map((flag) => ({
        user_id: tester_id,
        event_type: flag.toLowerCase().replace(/\s+/g, "_"),
        severity,
        details: { flag, breakdown, score },
      }));
      await supabase.from("fraud_events").insert(fraudEvents);
    }

    // Update trust score on profile
    await supabase
      .from("profiles")
      .update({ trust_score: score })
      .eq("id", tester_id);

    return NextResponse.json({ score, recommendation, flags, severity, breakdown });
  } catch (err) {
    console.error("Fraud check error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
