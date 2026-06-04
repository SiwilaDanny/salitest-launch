import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyApiKey } from "@/lib/api-auth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// GET /api/v1/campaigns
// List all campaigns for the authenticated developer
export async function GET(request) {
  const { developer_id, error } = await verifyApiKey(request);
  if (error) {
    return NextResponse.json({ error }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status"); // optional filter

  let query = supabaseAdmin
    .from("campaigns")
    .select(`
      id, title, description, platform, testers_required, testers_enrolled, 
      duration_days, reward_per_tester, status, starts_at, ends_at, created_at,
      apps ( name, package_name, bundle_id )
    `)
    .eq("developer_id", developer_id)
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data: campaigns, error: dbError } = await query;

  if (dbError) {
    return NextResponse.json({ error: "Failed to fetch campaigns." }, { status: 500 });
  }

  // Format response
  const formatted = campaigns.map(c => ({
    id: c.id,
    title: c.title,
    app: c.apps?.name || "Unknown App",
    platform: c.platform,
    package_name: c.apps?.package_name,
    bundle_id: c.apps?.bundle_id,
    status: c.status,
    testers: {
      enrolled: c.testers_enrolled,
      required: c.testers_required
    },
    duration_days: c.duration_days,
    reward_per_tester: c.reward_per_tester,
    starts_at: c.starts_at,
    created_at: c.created_at
  }));

  return NextResponse.json({ data: formatted });
}

// POST /api/v1/campaigns
// Programmatically create a new campaign
export async function POST(request) {
  const { developer_id, error } = await verifyApiKey(request);
  if (error) {
    return NextResponse.json({ error }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      app_id,
      title,
      description,
      testers_required = 12,
      duration_days = 14,
      reward_per_tester = 3.00,
      tasks = []
    } = body;

    if (!app_id || !title) {
      return NextResponse.json({ error: "Missing required fields: app_id, title" }, { status: 400 });
    }

    if (testers_required < 12) {
      return NextResponse.json({ error: "testers_required must be at least 12" }, { status: 400 });
    }

    if (reward_per_tester < 1.50) {
      return NextResponse.json({ error: "reward_per_tester must be at least 1.50 USD" }, { status: 400 });
    }

    // Verify app belongs to developer
    const { data: appData, error: appError } = await supabaseAdmin
      .from("apps")
      .select("id, platform")
      .eq("id", app_id)
      .eq("developer_id", developer_id)
      .single();

    if (appError || !appData) {
      return NextResponse.json({ error: "App not found or does not belong to you." }, { status: 404 });
    }

    const budget_total = Number(testers_required) * Number(reward_per_tester);

    const { data: newCampaign, error: insertError } = await supabaseAdmin
      .from("campaigns")
      .insert({
        developer_id,
        app_id,
        title,
        description,
        platform: appData.platform,
        testers_required,
        duration_days,
        reward_per_tester,
        budget_total,
        status: "pending"
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    let insertedTasks = [];
    if (Array.isArray(tasks) && tasks.length > 0) {
      const taskRows = tasks.map((task) => ({
        campaign_id: newCampaign.id,
        day_number: Number(task.day_number),
        title: task.title,
        description: task.description ?? null,
        is_optional: Boolean(task.is_optional)
      }));

      const invalidTask = taskRows.find((task) => !task.title || Number.isNaN(task.day_number) || task.day_number < 1 || task.day_number > Number(duration_days));
      if (invalidTask) {
        return NextResponse.json({ error: "Each task must include a title and a valid day_number." }, { status: 400 });
      }

      const { data: taskData, error: taskInsertError } = await supabaseAdmin
        .from("campaign_tasks")
        .insert(taskRows)
        .select();

      if (taskInsertError) {
        throw taskInsertError;
      }

      insertedTasks = taskData || [];
    }

    return NextResponse.json({ 
      message: "Campaign created successfully. It is currently in 'pending' status and requires funding.",
      data: { ...newCampaign, tasks: insertedTasks }
    }, { status: 201 });

  } catch (err) {
    console.error("Campaign Creation Error:", err);
    return NextResponse.json({ error: "Failed to create campaign. Invalid payload." }, { status: 400 });
  }
}
