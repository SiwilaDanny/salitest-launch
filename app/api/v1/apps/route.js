import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Helper to get authenticated user from request
async function getAuthUser(request) {
  const { createServerClient } = await import("@supabase/ssr");
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
      },
    }
  );

  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return { user: null, error: "Unauthorized" };
  }

  return { user, error: null };
}

// GET /api/v1/apps
// List all apps for the authenticated developer
export async function GET(request) {
  const { user, error: authError } = await getAuthUser(request);
  if (authError || !user) {
    return NextResponse.json({ error: authError || "Unauthorized" }, { status: 401 });
  }

  const { data: apps, error: dbError } = await supabaseAdmin
    .from("apps")
    .select("*")
    .eq("developer_id", user.id)
    .order("created_at", { ascending: false });

  if (dbError) {
    return NextResponse.json({ error: "Failed to fetch apps." }, { status: 500 });
  }

  return NextResponse.json({ data: apps });
}

// POST /api/v1/apps
// Create a new app with icon upload
export async function POST(request) {
  const { user, error: authError } = await getAuthUser(request);
  if (authError || !user) {
    return NextResponse.json({ error: authError || "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    
    const name = formData.get("name");
    const description = formData.get("description");
    const category = formData.get("category");
    const platform = formData.get("platform") || "android";
    const packageName = formData.get("packageName");
    const bundleId = formData.get("bundleId");
    const testingLink = formData.get("testingLink");
    const testflightLink = formData.get("testflightLink");
    const iconFile = formData.get("icon");

    // Validate required fields
    if (!name || !description || !category) {
      return NextResponse.json(
        { error: "Missing required fields: name, description, category" },
        { status: 400 }
      );
    }

    if (!iconFile) {
      return NextResponse.json(
        { error: "App icon is required" },
        { status: 400 }
      );
    }

    let iconUrl = null;

    // Upload icon to Supabase Storage
    if (iconFile && iconFile.size > 0) {
      const buffer = await iconFile.arrayBuffer();
      const fileExt = iconFile.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from("app-icons")
        .upload(fileName, buffer, {
          contentType: iconFile.type,
          upsert: false,
        });

      if (uploadError) {
        return NextResponse.json(
          { error: `Icon upload failed: ${uploadError.message}` },
          { status: 500 }
        );
      }

      // Get public URL
      const { data: publicUrl } = supabaseAdmin.storage
        .from("app-icons")
        .getPublicUrl(fileName);

      iconUrl = publicUrl.publicUrl;
    }

    // Create app record
    const { data: newApp, error: createError } = await supabaseAdmin
      .from("apps")
      .insert({
        developer_id: user.id,
        name,
        description,
        category,
        platform,
        package_name: packageName,
        bundle_id: bundleId,
        testing_link: testingLink,
        testflight_link: testflightLink,
        icon_url: iconUrl,
        status: "draft",
      })
      .select()
      .single();

    if (createError) {
      return NextResponse.json(
        { error: `Failed to create app: ${createError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: newApp }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: `Server error: ${err.message}` },
      { status: 500 }
    );
  }
}
