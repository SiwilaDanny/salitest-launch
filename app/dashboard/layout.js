"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const devLinks = [
  { href: "/dashboard", label: "Overview", icon: "📊" },
  { href: "/dashboard/apps", label: "My Apps", icon: "📱" },
  { href: "/dashboard/campaigns", label: "Campaigns", icon: "🚀" },
  { href: "/dashboard/billing", label: "Billing", icon: "💳" },
];

const testerLinks = [
  { href: "/dashboard", label: "Overview", icon: "📊" },
  { href: "/dashboard/browse", label: "Browse Apps", icon: "🔍" },
  { href: "/dashboard/active", label: "Active Tests", icon: "🧪" },
  { href: "/dashboard/earnings", label: "Earnings", icon: "💰" },
];

const adminLinks = [
  { href: "/dashboard/admin", label: "Overview", icon: "📊" },
  { href: "/dashboard/admin/users", label: "Users", icon: "👥" },
  { href: "/dashboard/admin/fraud", label: "Fraud Review", icon: "🛡️" },
  { href: "/dashboard/admin/reports", label: "Reports", icon: "📈" },
];

export default function DashboardLayout({ children }) {
  const pathname = usePathname();
  const [role, setRole] = useState("developer");
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

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

          if (profile) {
            setUserProfile(profile);
            setRole(profile.role || "developer");
          } else {
            // Fallback to user metadata
            setUserProfile({
              full_name: user.user_metadata?.full_name || "User",
              email: user.email,
            });
            setRole(user.user_metadata?.role || "developer");
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

  const links = role === "admin" ? adminLinks : role === "tester" ? testerLinks : devLinks;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <Link href="/" className="nav-logo" style={{ fontSize: "var(--text-lg)" }}>SaLiTeSt Launch</Link>
        </div>

        <div className="sidebar-section">Main Menu</div>
        <nav className="sidebar-nav">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className={`sidebar-link ${pathname === link.href ? "active" : ""}`}>
              <span>{link.icon}</span>
              <span>{link.label}</span>
            </Link>
          ))}
        </nav>

        <div style={{ padding: "var(--space-xl)", marginTop: "auto" }}>
          <div className="glass-card" style={{ padding: "var(--space-lg)", textAlign: "center" }}>
            <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginBottom: "var(--space-sm)" }}>Current Plan</p>
            <p style={{ fontWeight: 700, fontSize: "var(--text-lg)" }}>Starter</p>
            <Link href="/dashboard/billing" className="btn btn-secondary btn-sm" style={{ marginTop: "var(--space-md)", width: "100%" }}>
              Upgrade
            </Link>
          </div>

          <button 
            className="btn btn-ghost" 
            style={{ width: "100%", marginTop: "var(--space-md)", justifyContent: "flex-start", color: "var(--text-muted)" }}
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
            🚪 Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {/* Top bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-2xl)" }}>
          <div>
            <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 800 }}>
              {links.find((l) => l.href === pathname)?.label || "Dashboard"}
            </h1>
            <p style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)", marginTop: 2 }}>
              Welcome back, {userProfile?.full_name || (role === "developer" ? "Developer" : role === "tester" ? "Tester" : "Admin")}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
            <button className="btn btn-icon btn-ghost" title="Notifications" style={{ position: "relative" }}>
              🔔
              <span style={{ position: "absolute", top: 4, right: 4, width: 8, height: 8, borderRadius: "50%", background: "var(--brand-danger)" }} />
            </button>
            <div className="avatar">
              {userProfile?.full_name ? userProfile.full_name[0].toUpperCase() : (role === "developer" ? "D" : role === "tester" ? "T" : "A")}
            </div>
          </div>
        </div>

        {children}
      </main>
    </div>
  );
}
