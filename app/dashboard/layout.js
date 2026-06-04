"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const devLinks = [
  { href: "/dashboard", label: "Overview", icon: "OV" },
  { href: "/dashboard/apps", label: "My Apps", icon: "AP" },
  { href: "/dashboard/campaigns", label: "Campaigns", icon: "CM" },
  { href: "/dashboard/wallet", label: "My Wallet", icon: "WA" },
  { href: "/dashboard/billing", label: "Billing", icon: "BL" },
  { href: "/dashboard/developer/api", label: "API Access", icon: "API" },
];

const testerLinks = [
  { href: "/dashboard", label: "Overview", icon: "OV" },
  { href: "/dashboard/browse", label: "Browse Apps", icon: "BR" },
  { href: "/dashboard/active", label: "Active Tests", icon: "AT" },
  { href: "/dashboard/wallet", label: "My Wallet", icon: "WA" },
  { href: "/dashboard/earnings", label: "Earnings", icon: "EA" },
];

const adminLinks = [
  { href: "/dashboard/admin", label: "Overview", icon: "OV" },
  { href: "/dashboard/admin/users", label: "Users", icon: "US" },
  { href: "/dashboard/admin/payouts", label: "Payout Requests", icon: "PO" },
  { href: "/dashboard/admin/fraud", label: "Fraud Review", icon: "FR" },
  { href: "/dashboard/admin/wallet", label: "Wallet Management", icon: "WA" },
  { href: "/dashboard/admin/campaigns", label: "Campaign Review", icon: "CR" },
  { href: "/dashboard/admin/reports", label: "Reports", icon: "RP" },
];

const roleHome = {
  admin: "/dashboard/admin",
  developer: "/dashboard",
  tester: "/dashboard/browse",
};

const roleRoutes = {
  admin: ["/dashboard/admin"],
  developer: ["/dashboard", "/dashboard/apps", "/dashboard/campaigns", "/dashboard/wallet", "/dashboard/billing", "/dashboard/developer"],
  tester: ["/dashboard", "/dashboard/browse", "/dashboard/active", "/dashboard/wallet", "/dashboard/earnings"],
};

function canAccessRoute(role, pathname) {
  if (role === "admin") return true; // Admins have total access to all views and sections
  const routes = roleRoutes[role] || roleRoutes.developer;
  return routes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export default function DashboardLayout({ children }) {
  const pathname = usePathname();
  const [role, setRole] = useState("developer");
  const [activeViewRole, setActiveViewRole] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Load saved notifications
  useEffect(() => {
    try {
      const saved = localStorage.getItem("salitest_notifications");
      if (saved) setNotifications(JSON.parse(saved));
    } catch (e) {
      console.error("Error loading notifications:", e);
    }
  }, []);

  // Save notifications
  useEffect(() => {
    try {
      localStorage.setItem("salitest_notifications", JSON.stringify(notifications));
    } catch (e) {
      console.error("Error saving notifications:", e);
    }
  }, [notifications]);

  // Real-time notifications subscription
  useEffect(() => {
    // Request notification permission
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }
    
    const supabase = createClient();
    
    const channel = supabase
      .channel("public:campaigns")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "campaigns" }, async (payload) => {
        const newCampaign = payload.new;
        
        // Fetch app name
        const { data: appData } = await supabase
          .from("apps")
          .select("name")
          .eq("id", newCampaign.app_id)
          .maybeSingle();

        const appName = appData?.name || "New App";

        // Show browser notification
        if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
          new Notification(`🚀 New Campaign: ${appName}`, {
            body: `${newCampaign.title}\nReward: $${(newCampaign.reward_per_tester || 0).toFixed(2)}`,
            icon: "/favicon.ico"
          });
        }

        // Add to dropdown
        const newNotif = {
          id: newCampaign.id,
          title: `New Campaign: ${appName}`,
          message: `${newCampaign.title} is now open for testing. Earn $${(newCampaign.reward_per_tester || 0).toFixed(2)}!`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          unread: true
        };
        
        setNotifications(prev => [newNotif, ...prev]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    async function loadUser() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .single();

          let dbRole = "developer";
          if (profile) {
            setUserProfile(profile);
            dbRole = profile.role || "developer";
          } else {
            setUserProfile({
              full_name: user.user_metadata?.full_name || "User",
              email: user.email,
              avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture,
            });
            dbRole = user.user_metadata?.role || "developer";
          }
          setRole(dbRole);

          if (dbRole === "tester") {
            import("@/lib/fraud/fingerprint").then(async ({ getDeviceFingerprint }) => {
              const devInfo = await getDeviceFingerprint();
              if (devInfo) {
                await fetch("/api/devices/register", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(devInfo)
                }).catch(err => console.error("Device auto-registration error:", err));
              }
            });
          }

          if (dbRole === "admin") {
            const storedView = localStorage.getItem("salitest_admin_active_view");
            setActiveViewRole(storedView || "admin");
          } else {
            localStorage.removeItem("salitest_admin_active_view");
            setActiveViewRole(dbRole);
          }
        }
      } catch (err) {
        console.error("Error loading user profile:", err);
      } finally {
        setLoading(false);
      }
    }
    loadUser();
  }, []);

  const currentView = activeViewRole || role;
  const links = currentView === "admin" ? adminLinks : currentView === "tester" ? testerLinks : devLinks;
  const displayName = userProfile?.full_name || (role === "developer" ? "Developer" : role === "tester" ? "Tester" : "Admin");
  const initial = displayName[0]?.toUpperCase() || "U";
  const avatarUrl = userProfile?.avatar_url || userProfile?.picture_url || userProfile?.image_url;

  useEffect(() => {
    if (loading) return;
    const currentView = activeViewRole || role;
    if (pathname === "/dashboard" && currentView !== "developer") {
      window.location.replace(roleHome[currentView] || "/dashboard");
      return;
    }
    if (!canAccessRoute(role, pathname)) {
      window.location.replace(roleHome[currentView] || "/dashboard");
    }
  }, [loading, pathname, role, activeViewRole]);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-base-300">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  return (
    <div className="drawer lg:drawer-open">
      <input id="sidebar-drawer" type="checkbox" className="drawer-toggle" />

      {/* Main content area */}
      <div className="drawer-content bg-base-300 min-h-screen">
        {/* Top navbar */}
        <div className="navbar bg-base-300 border-b border-base-content/5 sticky top-0 z-30 px-6">
          <div className="flex-none lg:hidden">
            <label htmlFor="sidebar-drawer" className="btn btn-square btn-ghost">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="inline-block w-5 h-5 stroke-current"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
            </label>
          </div>
          <div className="flex-1 ml-2">
            <h1 className="text-xl font-bold">
              {links.find((l) => l.href === pathname)?.label || "Dashboard"}
            </h1>
            <p className="text-xs text-base-content/40 ml-0.5">Welcome back, {displayName}</p>
          </div>
          <div className="flex-none flex items-center gap-2">
            <div className={`dropdown dropdown-end ${dropdownOpen ? "dropdown-open" : ""}`}>
              <button 
                className="btn btn-ghost btn-circle" 
                title="Notifications"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                onBlur={() => setTimeout(() => setDropdownOpen(false), 200)}
              >
                <div className="indicator">
                  <svg className="h-5 w-5 stroke-current" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M9.5 19a2.5 2.5 0 0 0 5 0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {notifications.some(n => n.unread) && (
                    <span className="badge badge-xs badge-error indicator-item" />
                  )}
                </div>
              </button>
              <div className="dropdown-content card card-compact w-80 p-2 shadow bg-base-200 text-base-content border border-base-content/10 mt-3 z-50">
                <div className="card-body">
                  <div className="flex justify-between items-center border-b border-base-content/10 pb-2">
                    <h3 className="font-bold text-sm">Notifications</h3>
                    {notifications.some(n => n.unread) && (
                      <button 
                        className="text-[10px] text-primary hover:underline font-bold"
                        onClick={() => {
                          setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
                        }}
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-60 overflow-y-auto space-y-2 mt-2">
                    {notifications.length === 0 ? (
                      <p className="text-xs text-base-content/40 text-center py-4">No new notifications</p>
                    ) : (
                      notifications.map((n) => (
                        <div 
                          key={n.id} 
                          className={`p-2 rounded-lg text-left transition-colors cursor-pointer ${n.unread ? "bg-primary/10 border-l-2 border-primary" : "hover:bg-base-300"}`}
                          onClick={() => {
                            setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, unread: false } : item));
                            window.location.href = "/dashboard/browse";
                          }}
                        >
                          <div className="flex justify-between items-start">
                            <span className={`text-xs font-bold ${n.unread ? "text-primary" : ""}`}>{n.title}</span>
                            <span className="text-[9px] text-base-content/30">{n.time}</span>
                          </div>
                          <p className="text-[10px] text-base-content/70 mt-1 leading-relaxed">{n.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="dropdown dropdown-end">
              <div tabIndex={0} role="button" className="avatar btn btn-ghost btn-circle" title={displayName}>
                <div className="w-10 rounded-full border border-base-content/10 bg-base-200 ring-2 ring-primary/25 ring-offset-2 ring-offset-base-300">
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarUrl} alt={`${displayName} profile`} className="object-cover" />
                  ) : (
                    <div className="grid h-full w-full place-items-center bg-gradient-to-br from-primary/80 to-secondary/70 text-primary-content">
                      <span className="text-sm font-black">{initial}</span>
                    </div>
                  )}
                </div>
              </div>
              <ul tabIndex={0} className="dropdown-content menu menu-sm bg-base-200 rounded-box z-50 mt-3 w-56 p-2 shadow-lg border border-base-content/10 space-y-1">
                <li className="menu-title px-3 pt-2 pb-1">
                  <div>
                    <p className="font-bold text-sm text-base-content">{displayName}</p>
                    <p className="text-[10px] text-base-content/40 font-normal truncate">{userProfile?.email || ''}</p>
                  </div>
                </li>
                <div className="divider my-0 h-px" />
                <li>
                  <a onClick={() => window.location.href = '/dashboard/wallet'} className="flex items-center gap-2 text-xs font-semibold">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                    My Wallet
                  </a>
                </li>
                <li>
                  <a onClick={() => window.location.href = '/dashboard/earnings'} className="flex items-center gap-2 text-xs font-semibold">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                    Earnings
                  </a>
                </li>
                <div className="divider my-0 h-px" />
                <li>
                  <a 
                    onClick={async () => {
                      const { createClient } = await import('@/lib/supabase/client');
                      const supabase = createClient();
                      await supabase.auth.signOut();
                      window.location.href = '/login';
                    }} 
                    className="flex items-center gap-2 text-xs font-semibold text-error hover:bg-error/10"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                    Sign Out
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="p-6 animate-fade-in">
          {children}
        </main>
      </div>

      {/* Sidebar */}
      <div className="drawer-side">
        <label htmlFor="sidebar-drawer" aria-label="close sidebar" className="drawer-overlay" />
        <aside className="w-64 min-h-screen bg-base-200 border-r border-base-content/5 flex flex-col">
          {/* Logo */}
          <div className="p-5 pb-2">
            <Link href="/" className="text-lg font-extrabold text-gradient">SaLiTeSt Launch</Link>
          </div>

          {role === "admin" && (
            <div className="px-4 mb-4">
              <div className="form-control w-full">
                <label className="label py-1">
                  <span className="label-text text-[10px] font-bold uppercase tracking-widest text-base-content/30">Active View</span>
                </label>
                <select
                  className="select select-bordered select-xs w-full font-semibold text-xs bg-base-300"
                  value={activeViewRole || "admin"}
                  onChange={(e) => {
                    const newView = e.target.value;
                    localStorage.setItem("salitest_admin_active_view", newView);
                    setActiveViewRole(newView);
                    window.location.replace(roleHome[newView] || "/dashboard");
                  }}
                >
                  <option value="admin">🛡️ Admin Dashboard</option>
                  <option value="developer">💻 Developer Dashboard</option>
                  <option value="tester">📱 Tester Dashboard</option>
                </select>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="px-3 mt-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-base-content/30 px-3 mb-2">Main Menu</p>
            <ul className="menu menu-sm gap-0.5">
              {links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={pathname === link.href ? "active font-semibold" : "text-base-content/60"}
                  >
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-base-300 text-[9px] font-black tracking-wide text-base-content/55">
                      {link.icon}
                    </span>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Bottom section */}
          <div className="mt-auto p-4 space-y-3">
            <div className="card bg-base-100 border border-base-content/5">
              <div className="card-body p-4 items-center text-center gap-1">
                <p className="text-[10px] text-base-content/30 uppercase tracking-wider">Current Plan</p>
                <p className="font-bold">Starter</p>
                <Link href="/dashboard/billing" className="btn btn-outline btn-xs btn-block mt-2">Upgrade</Link>
              </div>
            </div>
            <button
              className="btn btn-ghost btn-sm btn-block justify-start text-base-content/40 font-normal"
              onClick={async () => {
                try {
                  const supabase = createClient();
                  await supabase.auth.signOut();
                  window.location.href = "/login";
                } catch (err) {
                  console.error("Sign out failed:", err);
                }
              }}
            >
              Sign Out
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
