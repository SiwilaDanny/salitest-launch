"use client";

import { useEffect, useState, useCallback, Fragment } from "react";
import { createClient } from "@/lib/supabase/client";

const roleStyle = {
  admin: "select-error text-error bg-error/10 border-error/20",
  developer: "select-primary text-primary bg-primary/10 border-primary/20",
  tester: "select-secondary text-secondary bg-secondary/10 border-secondary/20",
};

const statusBadge = {
  active: "badge-success",
  suspended: "badge-warning",
  banned: "badge-error",
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState(null);
  const [expandedUser, setExpandedUser] = useState(null);
  const [devices, setDevices] = useState({});
  const [alertMsg, setAlertMsg] = useState(null);
  const [noteEdits, setNoteEdits] = useState({});
  const [savingNote, setSavingNote] = useState(null);
  const [statusAction, setStatusAction] = useState({});

  const supabase = createClient();

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const { data, error: fetchErr } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (fetchErr) throw fetchErr;
      setUsers(data || []);
    } catch (err) {
      console.error("Error fetching users:", err);
      setError("Failed to load user profiles from database. Verify RLS permissions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  async function handleRoleChange(userId, newRole) {
    try {
      setUpdatingId(userId);
      const { error: updateErr } = await supabase
        .from("profiles")
        .update({ role: newRole, updated_at: new Date().toISOString() })
        .eq("id", userId);

      if (updateErr) throw updateErr;
      setUsers(prev => prev.map(u => (u.id === userId ? { ...u, role: newRole } : u)));
      setAlertMsg({ type: "success", text: `Role updated to "${newRole}" successfully.` });
    } catch (err) {
      console.error("Error updating role:", err);
      setAlertMsg({ type: "error", text: err.message || "Failed to update user role." });
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleStatusChange(userId, newStatus) {
    try {
      setUpdatingId(userId);
      const { error: updateErr } = await supabase
        .from("profiles")
        .update({
          account_status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (updateErr) throw updateErr;
      setUsers(prev =>
        prev.map(u => (u.id === userId ? { ...u, account_status: newStatus } : u))
      );
      setStatusAction({});
      setAlertMsg({ type: "success", text: `Account status changed to "${newStatus}".` });
    } catch (err) {
      console.error("Error updating status:", err);
      setAlertMsg({ type: "error", text: err.message || "Failed to update account status." });
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleSaveNotes(userId) {
    try {
      setSavingNote(userId);
      const notes = noteEdits[userId] ?? "";
      const { error: updateErr } = await supabase
        .from("profiles")
        .update({ admin_notes: notes, updated_at: new Date().toISOString() })
        .eq("id", userId);

      if (updateErr) throw updateErr;
      setUsers(prev =>
        prev.map(u => (u.id === userId ? { ...u, admin_notes: notes } : u))
      );
      setAlertMsg({ type: "success", text: "Admin notes saved." });
    } catch (err) {
      console.error("Error saving notes:", err);
      setAlertMsg({ type: "error", text: err.message || "Failed to save admin notes." });
    } finally {
      setSavingNote(null);
    }
  }

  async function fetchDevicesForUser(userId) {
    try {
      const { data, error: fetchErr } = await supabase
        .from("tester_devices")
        .select("*")
        .eq("tester_id", userId)
        .order("last_seen_at", { ascending: false });

      if (fetchErr) throw fetchErr;
      setDevices(prev => ({ ...prev, [userId]: data || [] }));
    } catch (err) {
      console.error("Error fetching devices:", err);
      setDevices(prev => ({ ...prev, [userId]: [] }));
    }
  }

  function toggleExpand(userId) {
    if (expandedUser === userId) {
      setExpandedUser(null);
    } else {
      setExpandedUser(userId);
      const user = users.find(u => u.id === userId);
      if (user) {
        setNoteEdits(prev => ({ ...prev, [userId]: user.admin_notes || "" }));
      }
      if (!devices[userId]) {
        fetchDevicesForUser(userId);
      }
    }
  }

  if (loading) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <div className="flex flex-col items-center gap-2">
          <span className="loading loading-spinner loading-lg text-primary" />
          <p className="text-xs text-base-content/40 font-semibold tracking-wider uppercase">Loading profiles...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">User Management</h2>
          <p className="text-sm text-base-content/45">
            Manage roles, account status, notes, and device registrations.
          </p>
        </div>
        <span className="badge badge-primary badge-outline font-bold px-3 py-3">
          {users.length} Total Users
        </span>
      </div>

      {alertMsg && (
        <div className={`alert ${alertMsg.type === "success" ? "alert-success" : "alert-error"} shadow-sm flex justify-between`}>
          <span>{alertMsg.text}</span>
          <button className="btn btn-ghost btn-xs" onClick={() => setAlertMsg(null)}>✕</button>
        </div>
      )}

      {error && (
        <div className="alert alert-error shadow-sm">
          <span>{error}</span>
        </div>
      )}

      <div className="overflow-x-auto rounded-box border border-base-content/10 bg-base-200 shadow-lg">
        <table className="table w-full">
          <thead>
            <tr className="bg-base-300/30 text-base-content/60">
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th className="text-center">Status</th>
              <th className="text-center">Trust</th>
              <th>Joined</th>
              <th className="text-center">Details</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan="7" className="text-center py-10 text-base-content/30 font-medium">
                  No registered users found.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <Fragment key={user.id}>
                  <tr key={user.id} className="hover transition-all">
                    <td className="font-bold text-base-content/80">
                      {user.full_name || <span className="italic text-base-content/30">No Name</span>}
                    </td>
                    <td className="text-base-content/55 font-mono text-xs">{user.email}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <select
                          className={`select select-bordered select-xs w-28 font-bold transition-all ${roleStyle[user.role]} ${
                            updatingId === user.id ? "opacity-50 pointer-events-none" : ""
                          }`}
                          value={user.role}
                          onChange={(e) => handleRoleChange(user.id, e.target.value)}
                          disabled={updatingId === user.id}
                        >
                          <option value="developer">developer</option>
                          <option value="tester">tester</option>
                          <option value="admin">admin</option>
                        </select>
                        {updatingId === user.id && (
                          <span className="loading loading-spinner loading-xs text-primary" />
                        )}
                      </div>
                    </td>
                    <td className="text-center">
                      <span className={`badge ${statusBadge[user.account_status] || "badge-ghost"} text-[10px] font-extrabold uppercase px-2`}>
                        {user.account_status || "active"}
                      </span>
                    </td>
                    <td className="text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <div className={`w-2.5 h-2.5 rounded-full ${
                          (user.trust_score ?? 50) >= 70 ? "bg-success" : (user.trust_score ?? 50) >= 40 ? "bg-warning" : "bg-error"
                        }`} />
                        <span className="font-mono font-bold text-sm text-base-content/75">
                          {user.trust_score ?? 50}
                        </span>
                      </div>
                    </td>
                    <td className="text-xs text-base-content/40 font-medium">
                      {user.created_at ? new Date(user.created_at).toLocaleDateString(undefined, {
                        year: "numeric", month: "short", day: "numeric",
                      }) : "N/A"}
                    </td>
                    <td className="text-center">
                      <button
                        className="btn btn-ghost btn-xs font-bold"
                        onClick={() => toggleExpand(user.id)}
                      >
                        {expandedUser === user.id ? "▲ Close" : "▼ Expand"}
                      </button>
                    </td>
                  </tr>

                  {/* Expanded Detail Row */}
                  {expandedUser === user.id && (
                    <tr key={`${user.id}-detail`}>
                      <td colSpan="7" className="bg-base-300/20 p-0">
                        <div className="p-5 space-y-5">
                          {/* Account Status Actions */}
                          <div className="card bg-base-200 border border-base-content/5 p-4 space-y-3">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-base-content/50">
                              Account Moderation
                            </h4>
                            <div className="flex flex-wrap items-center gap-2">
                              {["active", "suspended", "banned"].map((st) => (
                                <button
                                  key={st}
                                  disabled={user.account_status === st || updatingId === user.id}
                                  className={`btn btn-sm text-xs font-bold ${
                                    st === "active" ? "btn-success" : st === "suspended" ? "btn-warning" : "btn-error"
                                  } ${user.account_status === st ? "btn-disabled opacity-40" : ""}`}
                                  onClick={() => {
                                    if (st === "active") {
                                      handleStatusChange(user.id, st);
                                    } else {
                                      setStatusAction({ userId: user.id, status: st });
                                    }
                                  }}
                                >
                                  {st === "active" ? "Reactivate" : st === "suspended" ? "Suspend" : "Ban"}
                                </button>
                              ))}
                              <span className="text-[10px] text-base-content/40 ml-2">
                                Current: <strong>{user.account_status || "active"}</strong>
                              </span>
                            </div>

                            {statusAction.userId === user.id && (
                              <div className={`p-3 rounded-lg border ${
                                statusAction.status === "banned" ? "bg-error/10 border-error/20" : "bg-warning/10 border-warning/20"
                              } space-y-2`}>
                                <p className="text-xs font-bold">
                                  Confirm {statusAction.status === "banned" ? "ban" : "suspension"} for {user.full_name || user.email}?
                                </p>
                                <div className="flex gap-2">
                                  <button
                                    className={`btn btn-sm text-xs font-bold ${statusAction.status === "banned" ? "btn-error" : "btn-warning"}`}
                                    onClick={() => handleStatusChange(user.id, statusAction.status)}
                                  >
                                    Confirm {statusAction.status}
                                  </button>
                                  <button
                                    className="btn btn-ghost btn-sm text-xs"
                                    onClick={() => setStatusAction({})}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Admin Notes */}
                          <div className="card bg-base-200 border border-base-content/5 p-4 space-y-3">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-base-content/50">
                              Admin Notes
                            </h4>
                            <textarea
                              className="textarea textarea-bordered textarea-sm w-full bg-base-300 text-sm"
                              rows="3"
                              placeholder="Internal notes about this user (visible to admins only)..."
                              value={noteEdits[user.id] ?? user.admin_notes ?? ""}
                              onChange={(e) =>
                                setNoteEdits(prev => ({ ...prev, [user.id]: e.target.value }))
                              }
                            />
                            <button
                              className="btn btn-primary btn-sm text-xs font-bold"
                              disabled={savingNote === user.id}
                              onClick={() => handleSaveNotes(user.id)}
                            >
                              {savingNote === user.id ? (
                                <><span className="loading loading-spinner loading-xs" /> Saving...</>
                              ) : (
                                "Save Notes"
                              )}
                            </button>
                          </div>

                          {/* Registered Devices */}
                          <div className="card bg-base-200 border border-base-content/5 p-4 space-y-3">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-base-content/50">
                              Registered Devices ({devices[user.id]?.length ?? "..."})
                            </h4>
                            {!devices[user.id] ? (
                              <div className="flex items-center gap-2 py-2">
                                <span className="loading loading-spinner loading-xs text-primary" />
                                <span className="text-xs text-base-content/40">Loading devices...</span>
                              </div>
                            ) : devices[user.id].length === 0 ? (
                              <p className="text-xs text-base-content/40 py-2">No registered devices.</p>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="table table-xs w-full">
                                  <thead>
                                    <tr className="text-base-content/50">
                                      <th>Device</th>
                                      <th>OS</th>
                                      <th>Browser</th>
                                      <th>IP / Geo</th>
                                      <th>Flags</th>
                                      <th>Last Seen</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {devices[user.id].map((dev) => (
                                      <tr key={dev.id} className="hover">
                                        <td className="text-xs font-semibold">{dev.device_name || "Unknown"}</td>
                                        <td className="text-xs">{dev.os} {dev.os_version}</td>
                                        <td className="text-xs">{dev.browser || "—"}</td>
                                        <td className="text-xs font-mono">
                                          {dev.ip_address || "—"}
                                          {dev.geo_country && <span className="text-base-content/40 ml-1">({dev.geo_country})</span>}
                                        </td>
                                        <td>
                                          <div className="flex gap-1">
                                            {dev.is_emulator && <span className="badge badge-error badge-xs text-[8px]">EMU</span>}
                                            {dev.is_vpn && <span className="badge badge-warning badge-xs text-[8px]">VPN</span>}
                                            {dev.is_bot && <span className="badge badge-error badge-xs text-[8px]">BOT</span>}
                                            {!dev.is_emulator && !dev.is_vpn && !dev.is_bot && (
                                              <span className="text-[10px] text-base-content/30">Clean</span>
                                            )}
                                          </div>
                                        </td>
                                        <td className="text-[10px] text-base-content/40">
                                          {dev.last_seen_at ? new Date(dev.last_seen_at).toLocaleString() : "—"}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>

                          {/* User ID Reference */}
                          <p className="text-[10px] text-base-content/30 font-mono">
                            User ID: {user.id}
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
