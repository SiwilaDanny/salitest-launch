import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyApiKey } from "@/lib/api-auth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// GET /api/v1/campaigns/[id]
// Get detailed information about a specific campaign
export async function GET(request, { params }) {
  const { developer_id, error } = await verifyApiKey(request);
  if (error) {
    return NextResponse.json({ error }, { status: 401 });
  }

  const { id: campaignId } = await params;

  const { data: campaign, error: dbError } = await supabaseAdmin
    .from("campaigns")
    .select(`
      *,
      apps ( name, platform, package_name, bundle_id )
    `)
    .eq("id", campaignId)
    .eq("developer_id", developer_id)
    .single();

  if (dbError || !campaign) {
    return NextResponse.json({ error: "Campaign not found or access denied." }, { status: 404 });
  }

  // Fetch recent enrollments/activity
  const { data: enrollments, error: enrollError } = await supabaseAdmin
    .from("enrollments")
    .select(`
      id, status, days_active, opted_in_at, last_activity_at,
      profiles ( full_name, country, trust_score )
    `)
    .eq("campaign_id", campaignId);

  if (enrollError) {
    console.error("Enrollment fetch error:", enrollError);
    return NextResponse.json({ error: "Failed to fetch enrollments." }, { status: 500 });
  }

  const { data: tasks, error: tasksError } = await supabaseAdmin
    .from("campaign_tasks")
    .select(`
      id, day_number, title, description, is_optional, created_at, updated_at
    `)
    .eq("campaign_id", campaignId)
    .order("day_number", { ascending: true })
    .order("created_at", { ascending: true });

  if (tasksError) {
    console.error("Task fetch error:", tasksError);
    return NextResponse.json({ error: "Failed to fetch campaign tasks." }, { status: 500 });
  }

  return NextResponse.json({
    data: {
      ...campaign,
      tasks: tasks || [],
      enrollments: enrollments || []
    }
  });
}
