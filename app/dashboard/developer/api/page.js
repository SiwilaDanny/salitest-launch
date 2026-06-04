"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

function resolvePlan(profile, user) {
  const rawPlan =
    profile?.subscription_plan ||
    profile?.plan ||
    profile?.billing_plan ||
    user?.user_metadata?.subscription_plan ||
    user?.user_metadata?.plan ||
    "starter";

  return String(rawPlan).toLowerCase();
}

export default function ApiAccessPage() {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [revealedKey, setRevealedKey] = useState(null);
  const [currentPlan, setCurrentPlan] = useState("starter");

  const hasEnterpriseApi = currentPlan === "enterprise";

  useEffect(() => {
    loadKeys();
  }, []);

  async function loadKeys() {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      const plan = resolvePlan(profile, user);
      setCurrentPlan(plan);

      if (plan !== "enterprise") {
        setKeys([]);
        return;
      }

      const { data } = await supabase
        .from("api_keys")
        .select("id, name, created_at, last_used_at")
        .eq("developer_id", user.id)
        .order("created_at", { ascending: false });

      if (data) setKeys(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function generateKey() {
    if (!hasEnterpriseApi) return;
    if (!newKeyName.trim()) return;
    setIsGenerating(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (resolvePlan(profile, user) !== "enterprise") {
        setCurrentPlan("starter");
        return;
      }

      // In a real production app, this generation and hashing should happen securely in an edge function/backend.
      // For this v1 demo, we generate a UUID locally, hash it to save in the DB, and show the raw UUID once.
      const rawKey = "sali_" + crypto.randomUUID().replace(/-/g, "");
      
      // We need to use the Web Crypto API to hash it to store securely
      const encoder = new TextEncoder();
      const data = encoder.encode(rawKey);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const keyHash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

      const { error } = await supabase
        .from("api_keys")
        .insert({
          developer_id: user.id,
          name: newKeyName.trim(),
          key_hash: keyHash
        });

      if (!error) {
        setNewKeyName("");
        setRevealedKey(rawKey);
        loadKeys();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  }

  async function revokeKey(id) {
    if (!confirm("Are you sure you want to revoke this API key? This action cannot be undone and any integrations using it will break.")) return;
    try {
      const supabase = createClient();
      await supabase.from("api_keys").delete().eq("id", id);
      loadKeys();
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="space-y-10 max-w-3xl mx-auto px-4 pb-12">
      <div className="flex flex-col gap-1 mb-2">
        <h2 className="text-2xl font-extrabold tracking-tight">API Access</h2>
        <p className="text-base text-base-content/50">Manage your API keys for programmatic access to SaLiTeSt.</p>
      </div>

      {!hasEnterpriseApi && (
        <div className="alert alert-warning items-start">
          <div>
            <h3 className="font-bold">API key generation is an Enterprise feature</h3>
            <p className="text-sm opacity-80">
              Your current plan is Starter. Upgrade to Enterprise to create API keys for integrations, CI pipelines, and automated campaign management.
            </p>
          </div>
          <Link href="/dashboard/billing" className="btn btn-sm btn-warning">View plans</Link>
        </div>
      )}

      <div className={`card border border-base-content/10 shadow ${hasEnterpriseApi ? "bg-gradient-to-br from-base-200 to-base-100" : "bg-base-200 opacity-75"}`}>
        <div className="card-body gap-6">
          <div className="flex items-center justify-between gap-3 border-b border-base-content/10 pb-2">
            <h3 className="font-bold text-lg">Generate New API Key</h3>
            {!hasEnterpriseApi && <span className="badge badge-warning badge-sm">Enterprise only</span>}
          </div>
          {!hasEnterpriseApi ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">Upgrade required</p>
                <p className="text-sm text-base-content/50">Starter accounts cannot create API keys.</p>
              </div>
              <Link href="/dashboard/billing" className="btn btn-outline btn-sm">Compare plans</Link>
            </div>
          ) : revealedKey ? (
            <div className="alert bg-success/10 border-success/30 text-success-content flex-col items-start gap-4">
              <div>
                <h4 className="font-bold flex items-center gap-2 text-success">✅ Key Generated Successfully</h4>
                <p className="text-sm opacity-80 mt-1">Please copy this key and store it securely. For your security, you will not be able to see it again.</p>
              </div>
              <div className="flex gap-2 w-full">
                <input type="text" className="input input-sm w-full font-mono bg-base-100" readOnly value={revealedKey} />
                <button className="btn btn-sm btn-success shadow" onClick={() => navigator.clipboard.writeText(revealedKey)}>Copy</button>
              </div>
              <button className="btn btn-sm btn-ghost self-end" onClick={() => setRevealedKey(null)}>Dismiss</button>
            </div>
          ) : (
            <div className="flex gap-3">
              <input 
                type="text" 
                className="input input-bordered flex-1" 
                placeholder="e.g. CI/CD Pipeline, Fastlane Script" 
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && generateKey()}
              />
              <button className="btn btn-primary shadow" onClick={generateKey} disabled={isGenerating || !newKeyName.trim() || !hasEnterpriseApi}>
                {isGenerating ? "Generating..." : "Generate Key"}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="card bg-base-200 border border-base-content/10 shadow">
        <div className="card-body gap-4 p-0">
          <h3 className="font-bold border-b border-base-content/10 pb-2 px-6 pt-6 text-lg">Your API Keys</h3>
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr className="bg-base-300 text-base-content/50">
                  <th className="pl-6">Name</th>
                  <th>Prefix</th>
                  <th>Created</th>
                  <th>Last Used</th>
                  <th className="pr-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="5" className="text-center py-4"><span className="loading loading-spinner loading-sm"></span></td></tr>
                ) : !hasEnterpriseApi ? (
                  <tr><td colSpan="5" className="text-center py-8 text-base-content/40">API keys are available on the Enterprise plan only.</td></tr>
                ) : keys.length === 0 ? (
                  <tr><td colSpan="5" className="text-center py-8 text-base-content/40">No API keys found. Generate one above to get started.</td></tr>
                ) : (
                  keys.map(k => (
                    <tr key={k.id} className="hover">
                      <td className="pl-6 font-medium">{k.name}</td>
                      <td className="font-mono text-xs">sali_••••••••</td>
                      <td className="text-sm text-base-content/60">{new Date(k.created_at).toLocaleDateString()}</td>
                      <td className="text-sm text-base-content/60">{k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : "Never"}</td>
                      <td className="pr-6 text-right">
                        <button className="btn btn-ghost btn-xs text-error" onClick={() => revokeKey(k.id)}>Revoke</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card bg-base-200 border border-base-content/10 shadow">
        <div className="card-body gap-6">
          <h3 className="font-bold border-b border-base-content/10 pb-2 text-lg">Quick Start</h3>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold mb-2">List Campaigns</p>
              <div className="mockup-code text-xs">
                <pre data-prefix="$"><code>{`curl -H "Authorization: Bearer sali_YOUR_KEY" \\`}</code></pre>
                <pre data-prefix=">"><code>     http://localhost:3000/api/v1/campaigns</code></pre>
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold mb-2">Create New Campaign</p>
              <div className="mockup-code text-xs">
                <pre data-prefix="$"><code>curl -X POST http://localhost:3000/api/v1/campaigns \</code></pre>
                <pre data-prefix=">"><code>{`     -H "Authorization: Bearer sali_YOUR_KEY" \\`}</code></pre>
                <pre data-prefix=">"><code>{`     -H "Content-Type: application/json" \\`}</code></pre>
                <pre data-prefix=">"><code>{`     -d '{"app_id": "YOUR_APP_UUID", "title": "Automated Beta Build v1.2", "testers_required": 20}'`}</code></pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
