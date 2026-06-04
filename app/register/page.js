"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { COUNTRIES } from "@/lib/constants";

function RegisterForm() {
  const searchParams = useSearchParams();
  const requestedRole = searchParams.get("role");
  const initialRole = requestedRole === "tester" ? "tester" : "developer";

  const [role, setRole] = useState(initialRole);
  const [form, setForm] = useState({ fullName: "", email: "", password: "", confirmPassword: "", country: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleRegister = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) { setError("Passwords do not match"); return; }
    setLoading(true);
    setError("");

    try {
      const supabase = createClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            full_name: form.fullName,
            role: role,
            country: form.country,
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      if (data?.session) {
        window.location.href = "/dashboard";
      } else {
        setError("Account created! Please check your email to verify before signing in.");
        setLoading(false);
      }
    } catch (err) {
      setError(err.message || "An unexpected error occurred");
      setLoading(false);
    }
  };

  return (
    <div className="card w-full max-w-lg bg-base-200 border border-base-content/5 shadow-xl animate-slide-up relative z-10">
      <div className="card-body gap-5">
        <div className="text-center">
          <Link href="/" className="text-2xl font-extrabold text-gradient inline-block mb-3">
            SaLiTeSt Launch
          </Link>
          <h1 className="text-2xl font-extrabold">Create Account</h1>
          <p className="text-sm text-base-content/40 mt-1">Join the app testing marketplace</p>
        </div>

        {/* Role Tabs */}
        <div className="tabs tabs-boxed bg-base-300 p-1">
          <button className={`tab flex-1 ${role === "developer" ? "tab-active" : ""}`} onClick={() => setRole("developer")}>
            🚀 Developer
          </button>
          <button className={`tab flex-1 ${role === "tester" ? "tab-active" : ""}`} onClick={() => setRole("tester")}>
            🧪 Tester
          </button>
        </div>

        {error && (
          <div className={`alert ${error.includes("created") ? "alert-info" : "alert-error"} alert-sm text-sm`}>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleRegister} className="flex flex-col gap-4">
          <div className="form-control">
            <label className="label"><span className="label-text text-sm">Full Name</span></label>
            <input className="input input-bordered w-full" placeholder="John Doe" value={form.fullName} onChange={update("fullName")} required />
          </div>

          <div className="form-control">
            <label className="label"><span className="label-text text-sm">Email Address</span></label>
            <input type="email" className="input input-bordered w-full" placeholder="you@example.com" value={form.email} onChange={update("email")} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="form-control">
              <label className="label"><span className="label-text text-sm">Password</span></label>
              <input type="password" className="input input-bordered w-full" placeholder="••••••••" value={form.password} onChange={update("password")} required />
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text text-sm">Confirm</span></label>
              <input type="password" className="input input-bordered w-full" placeholder="••••••••" value={form.confirmPassword} onChange={update("confirmPassword")} required />
            </div>
          </div>

          <div className="form-control">
            <label className="label"><span className="label-text text-sm">Country</span></label>
            <select className="select select-bordered w-full" value={form.country} onChange={update("country")} required>
              <option value="">Select your country</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
          </div>

          {role === "tester" && (
            <div className="alert alert-info alert-sm text-xs">
              <span>🧪 As a tester, you&apos;ll earn rewards for genuinely testing apps. Identity verification will be required before your first campaign.</span>
            </div>
          )}

          {role === "developer" && (
            <div className="alert bg-primary/5 border-primary/20 text-xs">
              <span>🚀 As a developer, you can create testing campaigns and get verified testers for your apps.</span>
            </div>
          )}

          <button type="submit" className={`btn btn-primary w-full ${loading ? "btn-disabled" : ""}`} disabled={loading}>
            {loading && <span className="loading loading-spinner loading-sm" />}
            {loading ? "Creating Account…" : `Create ${role === "developer" ? "Developer" : "Tester"} Account`}
          </button>
        </form>

        <p className="text-center text-sm text-base-content/40">
          Already have an account?{" "}
          <Link href="/login" className="link link-primary font-semibold">Sign In</Link>
        </p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-base-300 bg-grid p-6 relative">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 pointer-events-none" />
      <Suspense fallback={<span className="loading loading-dots loading-lg text-primary" />}>
        <RegisterForm />
      </Suspense>
    </div>
  );
}
