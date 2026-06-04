"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const roleHome = {
  admin: "/dashboard/admin",
  developer: "/dashboard",
  tester: "/dashboard/browse",
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      const user = data?.user;
      let role = user?.user_metadata?.role || "developer";

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

        role = profile?.role || role;
      }

      window.location.href = roleHome[role] || "/dashboard";
    } catch (err) {
      setError(err.message || "An unexpected error occurred");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-300 bg-grid p-6 relative">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 pointer-events-none" />

      <div className="card w-full max-w-md bg-base-200 border border-base-content/5 shadow-xl animate-slide-up relative z-10">
        <div className="card-body gap-6">
          <div className="text-center">
            <Link href="/" className="text-2xl font-extrabold text-gradient inline-block mb-4">
              SaLiTeSt Launch
            </Link>
            <h1 className="text-2xl font-extrabold">Welcome Back</h1>
            <p className="text-sm text-base-content/40 mt-1">Sign in to manage your testing campaigns</p>
          </div>

          {error && (
            <div className="alert alert-error alert-sm text-sm">
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div className="form-control">
              <label className="label" htmlFor="email">
                <span className="label-text text-sm">Email Address</span>
              </label>
              <input
                id="email"
                type="email"
                className="input input-bordered w-full"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-control">
              <label className="label" htmlFor="password">
                <span className="label-text text-sm">Password</span>
                <a href="#" className="label-text-alt link link-primary text-xs">Forgot password?</a>
              </label>
              <input
                id="password"
                type="password"
                className="input input-bordered w-full"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className={`btn btn-primary w-full mt-2 ${loading ? "btn-disabled" : ""}`} disabled={loading}>
              {loading && <span className="loading loading-spinner loading-sm" />}
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <p className="text-center text-sm text-base-content/40">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="link link-primary font-semibold">Sign Up</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
