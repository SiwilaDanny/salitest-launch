"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { COUNTRIES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const defaultTaskPlan = [
  { day_number: 1, title: "Install the test build", description: "Join the test track, install the app, and confirm the first launch works." },
  { day_number: 2, title: "Complete onboarding", description: "Create an account or sign in, finish onboarding, and note any confusing steps." },
  { day_number: 3, title: "Test the core feature", description: "Use the main feature from start to finish and capture any blockers." },
  { day_number: 5, title: "Check notifications and settings", description: "Review preferences, permissions, notification behavior, and account settings." },
  { day_number: 7, title: "Mid-campaign feedback", description: "Submit early feedback about crashes, confusing screens, and missing guidance." },
  { day_number: 10, title: "Repeat key workflow", description: "Use the app again after several days and look for broken state or stale data." },
  { day_number: 14, title: "Final review", description: "Submit final notes, screenshots, and a short quality rating for the full test period." },
];

export default function NewCampaignPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    appId: "", title: "", description: "",
    testersRequired: 12, durationDays: 14,
    rewardPerTester: 3,
    country: "",
    phone: "", operator: "mtn"
  });
  const [apps, setApps] = useState([]);
  const [loadingApps, setLoadingApps] = useState(true);
  const [tasks, setTasks] = useState([]);
  const [taskDraft, setTaskDraft] = useState({ day_number: 1, title: "", description: "", is_optional: false });
  const [paymentState, setPaymentState] = useState({ status: "idle", reference: null, error: null });
  const [exchangeRate, setExchangeRate] = useState(26.0);

  const update = (field) => (e) => {
    const value = e.target.value;
    setForm((current) => ({ ...current, [field]: value }));

    if (field === "durationDays") {
      const nextDuration = Math.max(14, Number(value) || 14);
      setTaskDraft((draft) => (
        Number(draft.day_number) > nextDuration ? { ...draft, day_number: nextDuration } : draft
      ));
      setTasks((currentTasks) => currentTasks.filter((task) => task.day_number <= nextDuration));
    }
  };
  const updateTaskDraft = (field) => (e) => {
    const value = field === "is_optional" ? e.target.checked : e.target.value;
    setTaskDraft({ ...taskDraft, [field]: value });
  };

  const durationDaysNumber = Math.max(14, Number(form.durationDays) || 14);
  const testersRequiredNumber = Math.max(12, Number(form.testersRequired) || 12);
  const rewardPerTesterNumber = Math.max(1.5, Number(form.rewardPerTester) || 1.5);
  const totalBudget = testersRequiredNumber * rewardPerTesterNumber;

  useEffect(() => {
    async function loadApps() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setPaymentState({ status: "error", reference: null, error: "Please sign in to create a campaign." });
          return;
        }

        const { data, error } = await supabase
          .from("apps")
          .select("id, name, platform, package_name, bundle_id, status")
          .eq("developer_id", user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setApps(data || []);
      } catch (err) {
        setPaymentState({ status: "error", reference: null, error: err?.message || "Failed to load your apps." });
      } finally {
        setLoadingApps(false);
      }
    }

    async function loadExchangeRate() {
      try {
        const res = await fetch('/api/wallet/exchange-rate');
        const data = await res.json();
        if (data.success && data.rate) {
          setExchangeRate(data.rate);
        }
      } catch (err) {
        console.error('Failed to fetch exchange rate:', err);
      }
    }

    loadApps();
    loadExchangeRate();
  }, []);

  useEffect(() => {
    let interval;
    if (paymentState.status === "pending" && paymentState.reference) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/payment/lenco/status?reference=${paymentState.reference}`);
          const data = await res.json();
          if (data.status === "completed") {
            setPaymentState({ status: "success", reference: null, error: null });
            clearInterval(interval);
            setTimeout(() => router.push("/dashboard/campaigns"), 2000);
          } else if (data.status === "failed") {
            setPaymentState({ status: "error", reference: null, error: "Payment failed. Please try again." });
            clearInterval(interval);
          }
        } catch (e) {
          console.error(e);
        }
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [paymentState, router]);

  const addTask = () => {
    if (!taskDraft.title.trim()) {
      setPaymentState({ status: "error", reference: null, error: "Add a task title before saving." });
      return;
    }
    const dayNumber = Number(taskDraft.day_number);
    if (!dayNumber || dayNumber < 1 || dayNumber > durationDaysNumber) {
      setPaymentState({ status: "error", reference: null, error: "Select a valid day for this task." });
      return;
    }

    setTasks((previous) => [
      ...previous,
      {
        day_number: dayNumber,
        title: taskDraft.title.trim(),
        description: taskDraft.description.trim(),
        is_optional: Boolean(taskDraft.is_optional),
      }
    ].sort((a, b) => a.day_number - b.day_number));

    setTaskDraft({ day_number: 1, title: "", description: "", is_optional: false });
    setPaymentState({ status: "idle", reference: null, error: null });
  };

  const removeTask = (index) => {
    setTasks((previous) => previous.filter((_, idx) => idx !== index));
  };

  const addDefaultTaskPlan = () => {
    setTasks(defaultTaskPlan
      .filter((task) => task.day_number <= durationDaysNumber)
      .map((task) => ({ ...task, is_optional: false }))
    );
    setPaymentState({ status: "idle", reference: null, error: null });
  };

  async function handlePayment() {
    if (!form.appId || !form.title || !form.phone) {
      setPaymentState({ status: "error", reference: null, error: "Please fill all required fields including mobile number." });
      return;
    }

    setPaymentState({ status: "loading", reference: null, error: null });

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const selectedApp = apps.find((a) => a.id === form.appId);
      if (!selectedApp) throw new Error("Select one of your registered apps.");
      const platform = selectedApp?.platform || "android";
      const budget_total = Number((testersRequiredNumber * rewardPerTesterNumber).toFixed(2));

      const { data: createdCampaign, error: campaignError } = await supabase
        .from("campaigns")
        .insert([{
          app_id: form.appId,
          developer_id: user.id,
          title: form.title,
          description: form.description,
          platform,
          testers_required: testersRequiredNumber,
          duration_days: durationDaysNumber,
          reward_per_tester: rewardPerTesterNumber,
          budget_total,
          requirements: form.country ? { countries: [form.country] } : {},
          status: "pending"
        }])
        .select("id")
        .single();

      if (campaignError || !createdCampaign) {
        throw new Error(campaignError?.message || "Failed to create campaign.");
      }

      const campaignId = createdCampaign.id;
      if (tasks.length) {
        const { error: taskError } = await supabase.from("campaign_tasks").insert(
          tasks.map((task) => ({
            campaign_id: campaignId,
            day_number: task.day_number,
            title: task.title,
            description: task.description,
            is_optional: task.is_optional,
          }))
        );

        if (taskError) {
          await supabase.from("campaigns").delete().eq("id", campaignId);
          throw new Error(taskError.message || "Failed to save campaign tasks.");
        }
      }

      const res = await fetch("/api/payment/lenco/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaign_id: campaignId,
          phone: form.phone,
          operator: form.operator,
          user_id: user.id
        })
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setPaymentState({ status: "pending", reference: data.reference, error: null });
    } catch (err) {
      setPaymentState({ status: "error", reference: null, error: err?.message || "Unable to launch campaign." });
    }
  }

  return (
    <div className="space-y-6">
      <Link href="/dashboard/campaigns" className="link link-hover text-sm text-base-content/50 inline-flex items-center gap-1">
        ← Back to Campaigns
      </Link>

      <div>
        <h2 className="text-xl font-bold">Create New Campaign</h2>
        <p className="text-sm text-base-content/40">Set up a 14-day closed testing campaign.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card bg-base-200 border border-base-content/5">
            <div className="card-body gap-4">
              <h3 className="font-bold border-b border-base-content/5 pb-2">Campaign Details</h3>
              <div className="form-control">
                <label className="label"><span className="label-text">Select App</span></label>
                <select className="select select-bordered" value={form.appId} onChange={update("appId")} disabled={loadingApps || apps.length === 0}>
                  <option value="">{loadingApps ? "Loading apps..." : apps.length ? "Choose an app..." : "Add an app first"}</option>
                  {apps.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.platform})</option>)}
                </select>
                {apps.length === 0 && !loadingApps ? (
                  <label className="label">
                    <Link href="/dashboard/apps/new" className="label-text-alt link link-primary">Add your first app before creating a campaign</Link>
                  </label>
                ) : null}
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">Campaign Title</span></label>
                <input className="input input-bordered" placeholder="e.g. FitTrack Pro — Closed Beta v1.2" value={form.title} onChange={update("title")} />
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">Testing Focus</span></label>
                <textarea className="textarea textarea-bordered h-24" placeholder="Describe key features to test..." value={form.description} onChange={update("description")} />
              </div>
            </div>
          </div>

          <div className="card bg-base-200 border border-base-content/5">
            <div className="card-body gap-4">
              <h3 className="font-bold border-b border-base-content/5 pb-2">Requirements</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="form-control">
                  <label className="label"><span className="label-text">Testers Needed</span></label>
                  <input type="number" className="input input-bordered" min={12} max={200} value={form.testersRequired} onChange={update("testersRequired")} />
                  <label className="label"><span className="label-text-alt text-base-content/40">Min: 12</span></label>
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text">Duration (days)</span></label>
                  <input type="number" className="input input-bordered" min={14} value={form.durationDays} onChange={update("durationDays")} />
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text">Reward ($)</span></label>
                  <input type="number" className="input input-bordered" min={1.5} step={0.1} value={form.rewardPerTester} onChange={update("rewardPerTester")} />
                  <label className="label"><span className="label-text-alt text-base-content/40">Min: $1.50</span></label>
                </div>
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">Target Countries (optional)</span></label>
                <select className="select select-bordered" value={form.country} onChange={update("country")}>
                  <option value="">Any country</option>
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="card bg-base-200 border border-base-content/5">
            <div className="card-body gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-base-content/5 pb-2">
                <div>
                  <h3 className="font-bold">Daily Tasks</h3>
                  <p className="text-sm text-base-content/50">Add tasks that testers should complete on specific campaign days.</p>
                </div>
                <button type="button" className="btn btn-outline btn-sm" onClick={addDefaultTaskPlan}>
                  Use 14-Day Plan
                </button>
              </div>

              {tasks.length > 0 ? (
                <div className="space-y-3">
                  {tasks.map((task, index) => (
                    <div key={`${task.day_number}-${index}`} className="rounded-xl border border-base-content/10 bg-base-100 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs text-base-content/50">Day {task.day_number}</p>
                          <p className="font-semibold">{task.title}</p>
                          {task.description ? <p className="text-sm text-base-content/70 mt-1">{task.description}</p> : null}
                          {task.is_optional ? <span className="badge badge-outline badge-sm mt-2">Optional</span> : null}
                        </div>
                        <button type="button" className="btn btn-ghost btn-xs text-error" onClick={() => removeTask(index)}>
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-base-content/50">No tasks added yet. Add a task to guide testers through each day.</p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="form-control">
                  <label className="label"><span className="label-text">Day</span></label>
                  <select className="select select-bordered" value={taskDraft.day_number} onChange={updateTaskDraft("day_number")}>
                    {Array.from({ length: durationDaysNumber }, (_, index) => index + 1).map((day) => (
                      <option key={day} value={day}>Day {day}</option>
                    ))}
                  </select>
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text">Task Title</span></label>
                  <input className="input input-bordered" placeholder="e.g. Install the beta build" value={taskDraft.title} onChange={updateTaskDraft("title")} />
                </div>
                <div className="form-control sm:col-span-2">
                  <label className="label"><span className="label-text">Task Description</span></label>
                  <textarea className="textarea textarea-bordered h-24" placeholder="Optional details for the tester..." value={taskDraft.description} onChange={updateTaskDraft("description")} />
                </div>
                <div className="form-control">
                  <label className="label cursor-pointer">
                    <span className="label-text">Optional task</span>
                    <input type="checkbox" className="checkbox checkbox-sm ml-2" checked={taskDraft.is_optional} onChange={updateTaskDraft("is_optional")} />
                  </label>
                </div>
                <div className="form-control sm:col-span-2">
                  <button type="button" className="btn btn-secondary" onClick={addTask}>Add Task</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4 lg:sticky lg:top-24">
          <div className="card bg-base-200 border border-primary/20">
            <div className="card-body gap-3">
              <h3 className="font-bold border-b border-base-content/5 pb-2">Summary</h3>

              <div className="flex justify-between text-sm">
                <span className="text-base-content/50">Testers</span>
                <span className="font-semibold">{testersRequiredNumber} verified</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-base-content/50">Duration</span>
                <span className="font-semibold">{durationDaysNumber} days</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-base-content/50">Tasks</span>
                <span className="font-semibold">{tasks.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-base-content/50">Reward / Tester</span>
                <span className="font-semibold">${rewardPerTesterNumber.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-base-content/50">
                <span>Platform Fee (15%)</span>
                <span>${(totalBudget * 0.15).toFixed(2)}</span>
              </div>

              <div className="border-t border-base-content/5 mt-2 pt-3 flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <span className="font-bold">Total</span>
                  <span className="text-2xl font-black text-gradient">${(totalBudget * 1.15).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-xs text-base-content/40">
                  <span>Kwacha equivalent (1 USD = {exchangeRate.toFixed(2)} ZMW)</span>
                  <span className="font-mono">ZK {((totalBudget * 1.15) * exchangeRate).toFixed(2)} ZMW</span>
                </div>
              </div>
            </div>
          </div>

          <div className="alert bg-success/10 border-success/20 text-sm">
            <div>
              <h3 className="font-bold flex items-center gap-2">🛡️ Fraud Protected</h3>
              <p className="text-base-content/70 mt-1">Every tester is verified through our 5-layer fraud prevention system.</p>
            </div>
          </div>

          <div className="card bg-base-200 border border-base-content/5">
            <div className="card-body gap-4 p-5">
              <h3 className="font-bold text-sm">Pay with Mobile Money</h3>

              {paymentState.error && (
                <div className="alert alert-error text-xs p-2">{paymentState.error}</div>
              )}

              {paymentState.status === "success" && (
                <div className="alert alert-success text-xs p-2">Payment successful! Redirecting...</div>
              )}

              {paymentState.status === "pending" ? (
                <div className="flex flex-col items-center justify-center p-4 gap-3 text-center">
                  <span className="loading loading-spinner text-primary"></span>
                  <p className="text-sm font-semibold">Check your phone!</p>
                  <p className="text-xs text-base-content/50">Please enter your PIN on your mobile device to authorize the payment.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="form-control">
                    <label className="label py-1"><span className="label-text text-xs">Operator</span></label>
                    <select className="select select-bordered select-sm" value={form.operator} onChange={update("operator")}>
                      <option value="mtn">MTN Mobile Money</option>
                      <option value="airtel">Airtel Money</option>
                      <option value="zamtel">Zamtel Kwacha</option>
                    </select>
                  </div>
                  <div className="form-control">
                    <label className="label py-1"><span className="label-text text-xs">Mobile Number</span></label>
                    <input className="input input-bordered input-sm" placeholder="e.g. 096..." value={form.phone} onChange={update("phone")} />
                  </div>
                  <button
                    className="btn btn-primary btn-block mt-2"
                    onClick={handlePayment}
                    disabled={paymentState.status === "loading" || loadingApps || apps.length === 0}
                  >
                    {paymentState.status === "loading" ? (
                      <>
                        <span className="loading loading-spinner loading-sm" />
                        Creating campaign...
                      </>
                    ) : (
                      `Pay ZK ${((totalBudget * 1.15) * exchangeRate).toFixed(2)} & Launch`
                    )}
                  </button>
                  <p className="text-[11px] leading-relaxed text-base-content/40">
                    Campaigns stay pending until mobile money payment is confirmed.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
