"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AppMark, platformLabel } from "@/app/dashboard/_components/AppMark";
import { createClient } from "@/lib/supabase/client";

const statusLabels = {
  pending: "Pending",
  funded: "Funded",
  recruiting: "Recruiting",
  in_progress: "In Progress",
  verification: "Verification",
  completed: "Completed",
  cancelled: "Cancelled",
};

export default function CampaignDetailPage() {
  const params = useParams();
  const campaignId = params?.id;
  const [campaign, setCampaign] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [taskDraft, setTaskDraft] = useState({ day_number: 1, title: "", description: "", is_optional: false });

  const durationDays = Number(campaign?.duration_days) || 14;
  const taskGroups = useMemo(() => {
    return tasks.reduce((groups, task) => {
      const day = task.day_number;
      groups[day] = groups[day] || [];
      groups[day].push(task);
      return groups;
    }, {});
  }, [tasks]);

  async function loadCampaign() {
    if (!campaignId) return;
    setLoading(true);
    setMessage("");

    try {
      const supabase = createClient();
      const { data: campaignData, error: campaignError } = await supabase
        .from("campaigns")
        .select(`
          *,
          apps ( name, platform, package_name, bundle_id, testing_link, testflight_link )
        `)
        .eq("id", campaignId)
        .single();

      if (campaignError) throw campaignError;

      const { data: taskData, error: taskError } = await supabase
        .from("campaign_tasks")
        .select(`
          id, campaign_id, day_number, title, description, is_optional, created_at,
          campaign_task_completions ( id, status, tester_id )
        `)
        .eq("campaign_id", campaignId)
        .order("day_number", { ascending: true })
        .order("created_at", { ascending: true });

      if (taskError) throw taskError;

      const { data: enrollmentData, error: enrollmentError } = await supabase
        .from("enrollments")
        .select(`
          id, status, days_active, last_activity_at, feedback_submitted,
          profiles ( full_name, country, trust_score )
        `)
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: false });

      if (enrollmentError) throw enrollmentError;

      setCampaign(campaignData);
      setTasks(taskData || []);
      setEnrollments(enrollmentData || []);
    } catch (err) {
      setMessage(err?.message || "Failed to load campaign.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCampaign();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  const updateDraft = (field) => (event) => {
    const value = field === "is_optional" ? event.target.checked : event.target.value;
    setTaskDraft((draft) => ({ ...draft, [field]: value }));
  };

  async function addTask() {
    const title = taskDraft.title.trim();
    const dayNumber = Number(taskDraft.day_number);

    if (!title || !dayNumber || dayNumber < 1 || dayNumber > durationDays) {
      setMessage("Add a task title and choose a valid campaign day.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("campaign_tasks")
        .insert({
          campaign_id: campaignId,
          day_number: dayNumber,
          title,
          description: taskDraft.description.trim() || null,
          is_optional: Boolean(taskDraft.is_optional),
        })
        .select("id, campaign_id, day_number, title, description, is_optional, created_at, campaign_task_completions ( id, status, tester_id )")
        .single();

      if (error) throw error;

      setTasks((current) => [...current, data].sort((a, b) => a.day_number - b.day_number));
      setTaskDraft({ day_number: 1, title: "", description: "", is_optional: false });
      setMessage("Task added.");
    } catch (err) {
      setMessage(err?.message || "Failed to add task.");
    } finally {
      setSaving(false);
    }
  }

  async function removeTask(taskId) {
    setSaving(true);
    setMessage("");

    try {
      const supabase = createClient();
      const { error } = await supabase.from("campaign_tasks").delete().eq("id", taskId);
      if (error) throw error;
      setTasks((current) => current.filter((task) => task.id !== taskId));
      setMessage("Task removed.");
    } catch (err) {
      setMessage(err?.message || "Failed to remove task.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="grid min-h-80 place-items-center">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard/campaigns" className="link link-hover text-sm text-base-content/50">Back to Campaigns</Link>
        <div className="alert alert-error text-sm">{message || "Campaign not found."}</div>
      </div>
    );
  }

  const appName = campaign.apps?.name || campaign.title;
  const completionTotal = tasks.reduce((total, task) => total + (task.campaign_task_completions?.length || 0), 0);

  return (
    <div className="space-y-6">
      <Link href="/dashboard/campaigns" className="link link-hover text-sm text-base-content/50 inline-flex items-center gap-1">
        Back to Campaigns
      </Link>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-center gap-4">
          <AppMark name={appName} />
          <div>
            <h2 className="text-xl font-bold">{campaign.title}</h2>
            <p className="text-sm text-base-content/40">
              {appName} · {platformLabel(campaign.platform)} · {statusLabels[campaign.status] || campaign.status}
            </p>
          </div>
        </div>
        <div className="stats stats-vertical sm:stats-horizontal bg-base-200 border border-base-content/5">
          <div className="stat py-3">
            <div className="stat-title text-xs">Testers</div>
            <div className="stat-value text-lg">{campaign.testers_enrolled || 0}/{campaign.testers_required}</div>
          </div>
          <div className="stat py-3">
            <div className="stat-title text-xs">Tasks</div>
            <div className="stat-value text-lg">{tasks.length}</div>
          </div>
          <div className="stat py-3">
            <div className="stat-title text-xs">Completions</div>
            <div className="stat-value text-lg">{completionTotal}</div>
          </div>
        </div>
      </div>

      {message ? <div className="alert alert-info text-sm">{message}</div> : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2 space-y-6">
          <div className="card bg-base-200 border border-base-content/5">
            <div className="card-body gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-base-content/5 pb-3">
                <div>
                  <h3 className="font-bold">Daily Task Schedule</h3>
                  <p className="text-sm text-base-content/50">Tasks testers see during the campaign window.</p>
                </div>
                <span className="badge badge-outline">{durationDays} days</span>
              </div>

              <div className="space-y-4">
                {Array.from({ length: durationDays }, (_, index) => index + 1).map((day) => {
                  const dayTasks = taskGroups[day] || [];
                  return (
                    <div key={day} className="rounded-lg border border-base-content/10 bg-base-100 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <h4 className="font-semibold">Day {day}</h4>
                        <span className="text-xs text-base-content/40">{dayTasks.length} task{dayTasks.length === 1 ? "" : "s"}</span>
                      </div>
                      {dayTasks.length ? (
                        <div className="space-y-3">
                          {dayTasks.map((task) => (
                            <div key={task.id} className="flex items-start justify-between gap-3 rounded-md bg-base-200 p-3">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-semibold">{task.title}</p>
                                  {task.is_optional ? <span className="badge badge-outline badge-xs">Optional</span> : null}
                                </div>
                                {task.description ? <p className="mt-1 text-sm text-base-content/60">{task.description}</p> : null}
                                <p className="mt-2 text-xs text-base-content/35">
                                  {task.campaign_task_completions?.length || 0} tester completions
                                </p>
                              </div>
                              <button type="button" className="btn btn-ghost btn-xs text-error" disabled={saving} onClick={() => removeTask(task.id)}>
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-base-content/40">No task scheduled.</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card bg-base-200 border border-base-content/5">
            <div className="card-body gap-4">
              <h3 className="font-bold border-b border-base-content/5 pb-2">Add Daily Task</h3>
              <div className="form-control">
                <label className="label"><span className="label-text">Day</span></label>
                <select className="select select-bordered" value={taskDraft.day_number} onChange={updateDraft("day_number")}>
                  {Array.from({ length: durationDays }, (_, index) => index + 1).map((day) => (
                    <option key={day} value={day}>Day {day}</option>
                  ))}
                </select>
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">Task Title</span></label>
                <input className="input input-bordered" value={taskDraft.title} onChange={updateDraft("title")} placeholder="e.g. Test checkout flow" />
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">Description</span></label>
                <textarea className="textarea textarea-bordered h-24" value={taskDraft.description} onChange={updateDraft("description")} placeholder="What should testers do or report?" />
              </div>
              <label className="label cursor-pointer justify-start gap-3">
                <input type="checkbox" className="checkbox checkbox-sm" checked={taskDraft.is_optional} onChange={updateDraft("is_optional")} />
                <span className="label-text">Optional task</span>
              </label>
              <button type="button" className="btn btn-primary" disabled={saving} onClick={addTask}>
                {saving ? <span className="loading loading-spinner loading-sm" /> : null}
                Add Task
              </button>
            </div>
          </div>

          <div className="card bg-base-200 border border-base-content/5">
            <div className="card-body gap-4">
              <h3 className="font-bold border-b border-base-content/5 pb-2">Tester Progress</h3>
              {enrollments.length ? (
                <div className="space-y-3">
                  {enrollments.map((enrollment) => (
                    <div key={enrollment.id} className="rounded-lg bg-base-100 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold">{enrollment.profiles?.full_name || "Tester"}</p>
                          <p className="text-xs text-base-content/40">{enrollment.profiles?.country || "Unknown country"}</p>
                        </div>
                        <span className="badge badge-sm">{enrollment.status}</span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-base-content/35">Days active</span>
                          <p className="font-semibold">{enrollment.days_active || 0}</p>
                        </div>
                        <div>
                          <span className="text-base-content/35">Trust score</span>
                          <p className="font-semibold">{enrollment.profiles?.trust_score ?? "N/A"}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-base-content/50">No testers enrolled yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
