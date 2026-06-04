import { NextResponse } from "next/server";

const roleRoutes = {
  admin: ["/dashboard/admin"],
  developer: ["/dashboard/apps", "/dashboard/campaigns", "/dashboard/billing", "/dashboard/developer"],
  tester: ["/dashboard/browse", "/dashboard/active", "/dashboard/earnings"],
};

const roleHome = {
  admin: "/dashboard/admin",
  developer: "/dashboard",
  tester: "/dashboard/browse",
};

function routeOwner(path) {
  for (const [role, routes] of Object.entries(roleRoutes)) {
    if (routes.some((route) => path === route || path.startsWith(`${route}/`))) {
      return role;
    }
  }
  return null;
}

export async function middleware(request) {
  // Skip Supabase auth if credentials are not configured (demo mode)
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.next();
  }

  // Dynamic import to avoid crash when env vars are missing
  const { createServerClient } = await import("@supabase/ssr");
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session
  const { data: { user } } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // Protected routes → redirect to login if not authed
  if (path.startsWith("/dashboard") && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (path.startsWith("/dashboard") && user) {
    const ownerRole = routeOwner(path);
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = profile?.role || user.user_metadata?.role || "developer";

    if (role !== "admin") {
      if (path === "/dashboard" && role !== "developer") {
        const url = request.nextUrl.clone();
        url.pathname = roleHome[role] || "/dashboard";
        return NextResponse.redirect(url);
      }

      if (ownerRole) {
        if (role !== ownerRole) {
          const url = request.nextUrl.clone();
          url.pathname = roleHome[role] || "/dashboard";
          return NextResponse.redirect(url);
        }
      }
    }
  }

  // Auth routes → redirect to dashboard if already authed
  if ((path === "/login" || path === "/register") && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = profile?.role || user.user_metadata?.role || "developer";
    const url = request.nextUrl.clone();
    url.pathname = roleHome[role] || "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|_next/webpack-hmr|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
