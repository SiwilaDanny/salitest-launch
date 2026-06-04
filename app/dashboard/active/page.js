"use client";

import { useState, useEffect } from "react";
import exifr from "exifr";
import { resolveDeviceName } from "@/lib/fraud/models";
import { createClient } from "@/lib/supabase/client";
import { AppMark, platformLabel } from "@/app/dashboard/_components/AppMark";

async function computeSHA256(file) {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

function getImageDimensions(file) {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => resolve({ width: null, height: null });
  });
}

function getBrowserDeviceInfo() {
  if (typeof window === "undefined") return null;
  const ua = navigator.userAgent;
  let os = "Unknown OS";
  if (ua.indexOf("Windows NT 10.0") !== -1) os = "Windows 10/11";
  else if (ua.indexOf("Macintosh") !== -1) os = "macOS";
  else if (ua.indexOf("Android") !== -1) os = "Android";
  else if (ua.indexOf("iPhone") !== -1 || ua.indexOf("iPad") !== -1) os = "iOS";
  else if (ua.indexOf("Linux") !== -1) os = "Linux";

  let browser = "Generic Browser";
  if (ua.indexOf("Chrome") !== -1 && ua.indexOf("Chromium") === -1) browser = "Chrome";
  else if (ua.indexOf("Safari") !== -1 && ua.indexOf("Chrome") === -1) browser = "Safari";
  else if (ua.indexOf("Firefox") !== -1) browser = "Firefox";
  else if (ua.indexOf("Edg") !== -1) browser = "Edge";

  let gpu = "Generic Graphics";
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (gl) {
      const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
      if (debugInfo) {
        const rawGpu = gl.getParameter(debugInfo.UNMASKED_RENDERER_RENDERER_ID) || "";
        gpu = rawGpu.replace(/ANGLE \((.+?)\)/, "$1").trim();
      }
    }
  } catch (e) { /* noop */ }

  return {
    os, browser, gpu,
    cores: navigator.hardwareConcurrency || "Unknown",
    memory: navigator.deviceMemory ? `${navigator.deviceMemory} GB` : "Unknown",
    screenSize: `${window.screen.width}×${window.screen.height} @${window.devicePixelRatio}x`,
  };
}

const activeCampaigns = [
  {
    id: "e1", app: "FitTrack Pro", platform: "android",
    day: 11, reward: 3, status: "active",
    checkIns: [true,true,true,true,true,true,true,true,true,true,true,false,false,false],
    testingLink: "https://play.google.com/apps/testing/com.fittrack.pro",
  },
  {
    id: "e2", app: "RideShare Lite", platform: "both",
    day: 7, reward: 6, status: "active",
    checkIns: [true,true,true,true,true,true,true,false,false,false,false,false,false,false],
    testingLink: "https://testflight.apple.com/join/abc123",
  },
];

export default function ActiveTestsPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);
  const [screenshot, setScreenshot] = useState(null);
  const [metaInfo, setMetaInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [bugs, setBugs] = useState("");
  const [suggestions, setSuggestions] = useState("");
  const [success, setSuccess] = useState(false);
  const [testerId, setTesterId] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [verificationResult, setVerificationResult] = useState(null);

  useEffect(() => {
    async function loadSession() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) setTesterId(user.id);
      } catch (err) { console.error("Failed to load session:", err); }
    }
    loadSession();
  }, []);

  const handleOpenModal = (app) => {
    setSelectedApp(app);
    setScreenshot(null);
    setMetaInfo(null);
    setBugs("");
    setSuggestions("");
    setSuccess(false);
    setErrorMessage("");
    setVerificationResult(null);
    setModalOpen(true);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setScreenshot(file);
    setLoading(true);
    try {
      const fileHash = await computeSHA256(file);
      const { width, height } = await getImageDimensions(file);
      let exifData = null;
      try {
        exifData = await exifr.parse(file, { tiff: true, xmp: true, gps: true, exif: true });
      } catch (exifErr) { console.warn("Failed to parse EXIF:", exifErr); }
      const browserDev = getBrowserDeviceInfo();
      setMetaInfo({
        name: file.name,
        size: `${(file.size / 1024).toFixed(1)} KB`,
        hash: fileHash.substring(0, 32) + "…",
        width: width || "Unknown",
        height: height || "Unknown",
        make: exifData?.Make || "N/A (Screenshot)",
        model: exifData?.Model ? resolveDeviceName(exifData.Model) : "No EXIF hardware data",
        software: exifData?.Software || "None detected",
        takenAt: exifData?.DateTimeOriginal ? new Date(exifData.DateTimeOriginal).toLocaleString() : "No metadata",
        browserOS: browserDev?.os,
        browserName: browserDev?.browser,
        browserGPU: browserDev?.gpu,
        browserCores: browserDev?.cores,
        browserMemory: browserDev?.memory,
        browserScreen: browserDev?.screenSize,
      });
    } catch (err) {
      console.error("Error verifying image:", err);
      setMetaInfo({ name: file.name, size: `${(file.size / 1024).toFixed(1)} KB`, hash: "Error", width: "?", height: "?", make: "Generic", model: "Parse failed", software: "Unknown", takenAt: "Unknown" });
    } finally { setLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");
    setVerificationResult(null);
    if (!testerId) { setErrorMessage("Please sign in as a tester."); setLoading(false); return; }
    if (!screenshot) { setErrorMessage("Please upload a screenshot."); setLoading(false); return; }
    try {
      const formData = new FormData();
      formData.append("tester_id", testerId);
      formData.append("campaign_id", selectedApp?.id || "e1");
      formData.append("rating", "5");
      formData.append("usability_score", "8");
      formData.append("bugs_found", bugs);
      formData.append("suggestions", suggestions);
      formData.append("screenshot", screenshot);
      const response = await fetch("/api/feedback/submit", { method: "POST", body: formData });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to submit.");
      setVerificationResult(result);
      setSuccess(true);
      setBugs(""); setSuggestions(""); setScreenshot(null);
      setTimeout(() => setModalOpen(false), result.isFlagged ? 5000 : 2000);
    } catch (err) {
      console.error("Submission failed:", err);
      setErrorMessage(err.message || "An unexpected error occurred.");
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Active Testing Sessions</h2>
        <p className="text-sm text-base-content/40">{activeCampaigns.length} active campaigns — upload screenshots daily to verify progress</p>
      </div>

      <div className="space-y-5">
        {activeCampaigns.map((c) => {
          const daysLeft = 14 - c.day;
          const progress = Math.round((c.day / 14) * 100);
          return (
            <div key={c.id} className="card bg-base-200 border border-base-content/5">
              <div className="card-body gap-5">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <AppMark name={c.app} />
                    <div>
                      <h3 className="font-bold text-lg">{c.app}</h3>
                      <p className="text-xs text-base-content/30">{platformLabel(c.platform)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-black text-success">${c.reward}</div>
                    <div className="text-[10px] text-base-content/30">pending reward</div>
                  </div>
                </div>

                {/* Progress */}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-base-content/50">Day {c.day} of 14</span>
                    <span className="text-base-content/30">{daysLeft} days left</span>
                  </div>
                  <progress className="progress progress-primary w-full h-2" value={progress} max="100" />
                </div>

                {/* Check-in calendar */}
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-base-content/30 font-semibold mb-1.5">Check-In Calendar</p>
                  <div className="flex gap-1">
                    {c.checkIns.map((checked, i) => {
                      const isToday = i === c.day - 1;
                      const isFuture = i >= c.day;
                      return (
                        <div key={i} className={`flex-1 h-7 rounded text-[10px] font-bold flex items-center justify-center relative ${
                          checked ? "bg-success text-success-content" :
                          isToday && !checked ? "bg-warning text-warning-content" :
                          isFuture ? "bg-base-300 text-base-content/20" :
                          "bg-error/30 text-error"
                        }`}>
                          {checked ? "✓" : isToday && !checked ? "!" : isFuture ? "" : "✗"}
                          {isToday && <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[8px] text-warning">▼</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <button className="btn btn-primary flex-1" onClick={() => handleOpenModal(c)}>
                    📸 Verify Screenshot & Submit
                  </button>
                  <a href={c.testingLink} target="_blank" rel="noreferrer" className="btn btn-outline">
                    🔗 Open App
                  </a>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ═══════ MODAL ═══════ */}
      {modalOpen && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-xl bg-base-200">
            {/* Header */}
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-bold text-lg">Submit Proof for {selectedApp?.app}</h3>
              <button className="btn btn-sm btn-circle btn-ghost" onClick={() => setModalOpen(false)}>✕</button>
            </div>

            {success ? (
              <div className="text-center py-8">
                {verificationResult?.isFlagged ? (
                  <>
                    <div className="text-5xl mb-3">⚠️</div>
                    <h3 className="text-lg font-bold text-warning">Submitted with Warnings</h3>
                    <p className="text-sm text-base-content/40 mt-2 max-w-sm mx-auto leading-relaxed">
                      Screenshot flagged by fraud engine. Common causes: shared image, temporal anomalies, or hardware mismatch. Flagged for auditor review.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="text-5xl text-success mb-3">✓</div>
                    <h3 className="text-lg font-bold">Proof Submitted!</h3>
                    <p className="text-sm text-base-content/40 mt-1">Metadata verified. Your trust index is in good standing.</p>
                  </>
                )}
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {errorMessage && (
                  <div className="alert alert-error alert-sm text-sm">
                    <span>⚠️ {errorMessage}</span>
                  </div>
                )}

                {/* File upload */}
                <div className="form-control">
                  <label className="label"><span className="label-text text-sm">Upload Proof Screenshot</span></label>
                  <div className="border-2 border-dashed border-base-content/10 rounded-xl p-8 text-center cursor-pointer relative hover:border-primary/30 transition-colors">
                    <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                    {loading ? (
                      <div className="flex items-center justify-center gap-2 text-base-content/40">
                        <span className="loading loading-spinner loading-sm" />
                        Scanning EXIF & hash…
                      </div>
                    ) : screenshot ? (
                      <div>
                        <p className="font-semibold text-success">📸 {screenshot.name}</p>
                        <p className="text-xs text-base-content/30 mt-1">Click or drag to replace</p>
                      </div>
                    ) : (
                      <div>
                        <p className="font-semibold">Drag screenshot here or click to browse</p>
                        <p className="text-xs text-base-content/30 mt-1">JPEG / PNG accepted. Metadata checked.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Metadata display */}
                {metaInfo && (
                  <div className="rounded-lg bg-primary/5 border border-primary/10 p-4 space-y-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-base-content/30 font-bold mb-1.5">📸 EXIF Metadata</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                        <div><span className="text-base-content/30">SHA-256:</span> <code className="text-primary ml-1">{metaInfo.hash}</code></div>
                        <div><span className="text-base-content/30">Camera:</span> <strong className="ml-1">{metaInfo.model}</strong></div>
                        <div><span className="text-base-content/30">Size:</span> <strong className="ml-1">{metaInfo.width} × {metaInfo.height}px</strong></div>
                        <div><span className="text-base-content/30">Taken:</span> <strong className="ml-1">{metaInfo.takenAt}</strong></div>
                      </div>
                    </div>
                    {metaInfo.browserOS && (
                      <div className="border-t border-base-content/5 pt-3">
                        <p className="text-[10px] uppercase tracking-wider text-base-content/30 font-bold mb-1.5">💻 Device Telemetry</p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                          <div><span className="text-base-content/30">OS:</span> <strong className="ml-1">{metaInfo.browserOS}</strong></div>
                          <div><span className="text-base-content/30">Browser:</span> <strong className="ml-1">{metaInfo.browserName}</strong></div>
                          <div><span className="text-base-content/30">GPU:</span> <strong className="ml-1">{metaInfo.browserGPU}</strong></div>
                          <div><span className="text-base-content/30">Hardware:</span> <strong className="ml-1">{metaInfo.browserCores} cores, {metaInfo.browserMemory}</strong></div>
                          <div className="col-span-2"><span className="text-base-content/30">Display:</span> <strong className="ml-1">{metaInfo.browserScreen}</strong></div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Text inputs */}
                <div className="form-control">
                  <label className="label"><span className="label-text text-sm">Bugs / Issues Found</span></label>
                  <textarea className="textarea textarea-bordered h-20" placeholder="E.g., App crashed on payment screen (optional)" value={bugs} onChange={(e) => setBugs(e.target.value)} />
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text text-sm">Suggestions</span></label>
                  <textarea className="textarea textarea-bordered h-20" placeholder="E.g., Navigation could be simpler (optional)" value={suggestions} onChange={(e) => setSuggestions(e.target.value)} />
                </div>

                <button type="submit" className={`btn btn-primary btn-block ${loading ? "btn-disabled" : ""}`} disabled={loading || !screenshot}>
                  {loading && <span className="loading loading-spinner loading-sm" />}
                  {loading ? "Processing…" : "✓ Submit Feedback & Proof"}
                </button>
              </form>
            )}
          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={() => setModalOpen(false)}>close</button>
          </form>
        </dialog>
      )}
    </div>
  );
}
