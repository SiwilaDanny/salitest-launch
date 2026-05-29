"use client";

import { useState, useEffect } from "react";
import exifr from "exifr";
import { resolveDeviceName } from "@/lib/fraud/models";
import { createClient } from "@/lib/supabase/client";

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
    img.onerror = () => {
      resolve({ width: null, height: null });
    };
  });
}

function getBrowserDeviceInfo() {
  if (typeof window === "undefined") return null;
  const ua = navigator.userAgent;
  
  // OS Detection
  let os = "Unknown OS";
  if (ua.indexOf("Windows NT 10.0") !== -1) os = "Windows 10/11";
  else if (ua.indexOf("Windows NT 6.2") !== -1) os = "Windows 8";
  else if (ua.indexOf("Macintosh") !== -1) os = "macOS";
  else if (ua.indexOf("Android") !== -1) os = "Android";
  else if (ua.indexOf("iPhone") !== -1 || ua.indexOf("iPad") !== -1) os = "iOS";
  else if (ua.indexOf("Linux") !== -1) os = "Linux";

  // Browser Detection
  let browser = "Generic Browser";
  if (ua.indexOf("Chrome") !== -1 && ua.indexOf("Chromium") === -1) browser = "Chrome";
  else if (ua.indexOf("Safari") !== -1 && ua.indexOf("Chrome") === -1) browser = "Safari";
  else if (ua.indexOf("Firefox") !== -1) browser = "Firefox";
  else if (ua.indexOf("Edg") !== -1) browser = "Edge";

  // GPU Detection via WebGL
  let gpu = "Generic Graphics";
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (gl) {
      const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
      if (debugInfo) {
        const rawGpu = gl.getParameter(debugInfo.UNMASKED_RENDERER_RENDERER_ID) || "";
        // Clean up common wrapper strings
        gpu = rawGpu.replace(/ANGLE \((.+?)\)/, "$1").trim();
      }
    }
  } catch (e) {
    console.error("WebGL GPU check failed", e);
  }

  return {
    os,
    browser,
    gpu,
    cores: navigator.hardwareConcurrency || "Unknown Cores",
    memory: navigator.deviceMemory ? `${navigator.deviceMemory} GB RAM` : "Unknown Memory",
    screenSize: `${window.screen.width}x${window.screen.height} (${window.devicePixelRatio}x scale)`,
  };
}

const activeCampaigns = [
  {
    id: "e1", app: "FitTrack Pro", icon: "🏃", platform: "android",
    day: 11, reward: 3, status: "active",
    checkIns: [true,true,true,true,true,true,true,true,true,true,true,false,false,false],
    testingLink: "https://play.google.com/apps/testing/com.fittrack.pro",
  },
  {
    id: "e2", app: "RideShare Lite", icon: "🚗", platform: "both",
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
        if (user) {
          setTesterId(user.id);
        }
      } catch (err) {
        console.error("Failed to load session:", err);
      }
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

  // Real EXIF & Hash & Browser Telemetry Extraction
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setScreenshot(file);
    setLoading(true);

    try {
      // 1. Calculate real SHA-256 hash of the file
      const fileHash = await computeSHA256(file);

      // 2. Get image dimensions
      const { width, height } = await getImageDimensions(file);

      // 3. Try to parse real EXIF data using exifr
      let exifData = null;
      try {
        exifData = await exifr.parse(file, {
          tiff: true,
          xmp: true,
          gps: true,
          exif: true,
        });
      } catch (exifErr) {
        console.warn("Failed to parse EXIF:", exifErr);
      }

      // 4. Capture current browser device information telemetry
      const browserDev = getBrowserDeviceInfo();

      setMetaInfo({
        name: file.name,
        size: `${(file.size / 1024).toFixed(1)} KB`,
        hash: fileHash.substring(0, 32) + "...",
        width: width || "Unknown",
        height: height || "Unknown",
        make: exifData?.Make || "N/A (Screenshot)",
        model: exifData?.Model ? resolveDeviceName(exifData.Model) : "No EXIF hardware data (Laptop/Generic Screenshot)",
        software: exifData?.Software || "None detected",
        takenAt: exifData?.DateTimeOriginal
          ? new Date(exifData.DateTimeOriginal).toLocaleString()
          : "No creation time metadata",
        
        // Browser telemetry addition
        browserOS: browserDev?.os,
        browserName: browserDev?.browser,
        browserGPU: browserDev?.gpu,
        browserCores: browserDev?.cores,
        browserMemory: browserDev?.memory,
        browserScreen: browserDev?.screenSize,
      });
    } catch (err) {
      console.error("Error verifying image file:", err);
      setMetaInfo({
        name: file.name,
        size: `${(file.size / 1024).toFixed(1)} KB`,
        hash: "Calculation error",
        width: "Unknown",
        height: "Unknown",
        make: "Generic",
        model: "Failed to parse file",
        software: "Unknown",
        takenAt: "Unknown",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");
    setVerificationResult(null);

    if (!testerId) {
      setErrorMessage("Authentication session required. Please sign in as a tester.");
      setLoading(false);
      return;
    }

    if (!screenshot) {
      setErrorMessage("Please upload a verification screenshot.");
      setLoading(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append("tester_id", testerId);
      formData.append("campaign_id", selectedApp?.id || "e1");
      formData.append("rating", "5");
      formData.append("usability_score", "8");
      formData.append("bugs_found", bugs);
      formData.append("suggestions", suggestions);
      formData.append("screenshot", screenshot);

      const response = await fetch("/api/feedback/submit", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to submit feedback proof.");
      }

      setVerificationResult(result);
      setSuccess(true);

      // Reset form states
      setBugs("");
      setSuggestions("");
      setScreenshot(null);

      // Hold modal open slightly longer if flagged so they see the warning
      setTimeout(() => {
        setModalOpen(false);
      }, result.isFlagged ? 5000 : 2000);

    } catch (err) {
      console.error("Submission failed:", err);
      setErrorMessage(err.message || "An unexpected error occurred during submission.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: "var(--space-xl)" }}>
        <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700 }}>Active Testing Sessions</h2>
        <p style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>
          {activeCampaigns.length} active campaigns — upload screenshots daily to verify your testing progress!
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xl)" }}>
        {activeCampaigns.map((c) => {
          const daysLeft = 14 - c.day;
          const progress = Math.round((c.day / 14) * 100);

          return (
            <div key={c.id} className="glass-card" style={{ padding: "var(--space-xl)" }}>
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)", marginBottom: "var(--space-xl)" }}>
                <div style={{ width: 56, height: 56, borderRadius: "var(--radius-md)", background: "var(--bg-tertiary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "var(--text-2xl)" }}>
                  {c.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontWeight: 700, fontSize: "var(--text-lg)" }}>{c.app}</h3>
                  <p style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>
                    {c.platform === "android" ? "🤖 Android" : c.platform === "ios" ? "🍎 iOS" : "📱 Both"}
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "var(--text-2xl)", fontWeight: 800, color: "var(--brand-success)" }}>${c.reward}</div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>pending reward</div>
                </div>
              </div>

              {/* Progress */}
              <div style={{ marginBottom: "var(--space-lg)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-sm)" }}>
                  <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>Day {c.day} of 14</span>
                  <span style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>{daysLeft} days left</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${progress}%` }} />
                </div>
              </div>

              {/* 14-day calendar grid */}
              <div style={{ marginBottom: "var(--space-xl)" }}>
                <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "var(--space-sm)" }}>
                  Check-In Calendar
                </p>
                <div style={{ display: "flex", gap: 6 }}>
                  {c.checkIns.map((checked, i) => {
                    const isToday = i === c.day - 1;
                    const isFuture = i >= c.day;
                    return (
                      <div key={i} style={{
                        flex: 1, height: 32, borderRadius: "var(--radius-sm)",
                        background: checked ? "var(--brand-success)" : isToday && !checked ? "var(--brand-warning)" : isFuture ? "var(--bg-input)" : "rgba(255,118,117,0.3)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "var(--text-xs)", fontWeight: 600, color: isFuture ? "var(--text-muted)" : "white",
                        position: "relative",
                      }}>
                        {checked ? "✓" : isToday && !checked ? "!" : isFuture ? "" : "✗"}
                        {isToday && (
                          <span style={{ position: "absolute", top: -6, left: "50%", transform: "translateX(-50%)", fontSize: 8, color: "var(--brand-warning)" }}>▼</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: "var(--space-md)" }}>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => handleOpenModal(c)}>
                  📸 Verify Screenshot & Submit Feedback
                </button>
                <a href={c.testingLink} target="_blank" rel="noreferrer" className="btn btn-secondary">
                  🔗 Open App
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {/* ═══════ SUBMIT SCREENSHOT MODAL ═══════ */}
      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <h2 className="modal-title">Submit Proof for {selectedApp?.app}</h2>
              <button className="btn btn-icon btn-ghost" onClick={() => setModalOpen(false)}>✕</button>
            </div>

            {success ? (
              <div style={{ textAlign: "center", padding: "var(--space-2xl)" }}>
                {verificationResult?.isFlagged ? (
                  <>
                    <div style={{ fontSize: "var(--text-4xl)", color: "var(--brand-warning)", marginBottom: "var(--space-md)" }}>⚠️</div>
                    <h3 style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--brand-warning)" }}>Proof Submitted with Warnings</h3>
                    <p style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)", marginTop: 8, lineHeight: 1.6 }}>
                      Feedback uploaded, but screenshot flagged by our fraud scoring engine! Common causes: shared image, temporal anomalies, or hardware mismatch. This submission is flagged for auditor review.
                    </p>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: "var(--text-4xl)", color: "var(--brand-success)", marginBottom: "var(--space-md)" }}>✓</div>
                    <h3 style={{ fontSize: "var(--text-lg)", fontWeight: 700 }}>Proof Submitted!</h3>
                    <p style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)", marginTop: 4 }}>
                      Screenshot metadata parsed and verified. Your trust index is in good standing.
                    </p>
                  </>
                )}
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
                {errorMessage && (
                  <div style={{ background: "rgba(255,118,117,0.1)", border: "1px solid rgba(255,118,117,0.3)", borderRadius: "var(--radius-md)", padding: "var(--space-md)", color: "#FF7675", fontSize: "var(--text-sm)" }}>
                    ⚠️ {errorMessage}
                  </div>
                )}
                {/* Drag and Drop Screenshot */}
                <div className="form-group">
                  <label className="form-label">Upload Proof Screenshot</label>
                  <div style={{
                    border: "2px dashed var(--border-hover)",
                    borderRadius: "var(--radius-lg)",
                    padding: "var(--space-2xl)",
                    textAlign: "center",
                    background: "var(--bg-input)",
                    cursor: "pointer",
                    position: "relative",
                  }}>
                    <input type="file" accept="image/*" onChange={handleFileChange} style={{
                      position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer"
                    }} />
                    {loading ? (
                      <p style={{ color: "var(--text-muted)" }}>Scanning EXIF & Hash signature...</p>
                    ) : screenshot ? (
                      <div>
                        <p style={{ fontWeight: 600, color: "var(--brand-success)" }}>📸 {screenshot.name} Loaded</p>
                        <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: 4 }}>Click or drag to replace</p>
                      </div>
                    ) : (
                      <div>
                        <p style={{ fontSize: "var(--text-lg)", fontWeight: 600 }}>Drag screenshot here or click to browse</p>
                        <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: 4 }}>JPEG / PNG accepted. Metadata is checked to prevent sharing.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Exceeded Metadata Display (The wow factor!) */}
                {metaInfo && (
                  <div className="glass-card" style={{ padding: "var(--space-md)", background: "rgba(108, 92, 231, 0.08)", border: "1px solid rgba(108, 92, 231, 0.2)", display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
                    <div>
                      <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "var(--space-xs)", fontWeight: 700 }}>
                        📸 Screenshot EXIF Metadata
                      </p>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-xs)", fontSize: "var(--text-xs)" }}>
                        <div><span style={{ color: "var(--text-muted)" }}>SHA-256 Hash:</span> <code style={{ color: "var(--text-accent)" }}>{metaInfo.hash}</code></div>
                        <div><span style={{ color: "var(--text-muted)" }}>EXIF Camera:</span> <strong style={{ color: "var(--text-primary)" }}>{metaInfo.model}</strong></div>
                        <div><span style={{ color: "var(--text-muted)" }}>Dimensions:</span> <strong style={{ color: "var(--text-primary)" }}>{metaInfo.width} x {metaInfo.height} px</strong></div>
                        <div><span style={{ color: "var(--text-muted)" }}>Time Taken:</span> <strong style={{ color: "var(--text-primary)" }}>{metaInfo.takenAt}</strong></div>
                      </div>
                    </div>

                    <div style={{ borderTop: "1px dashed rgba(255,255,255,0.1)", paddingTop: "var(--space-sm)" }}>
                      <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "var(--space-xs)", fontWeight: 700 }}>
                        💻 Tester Upload Device Telemetry
                      </p>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-xs)", fontSize: "var(--text-xs)" }}>
                        <div><span style={{ color: "var(--text-muted)" }}>System OS:</span> <strong style={{ color: "var(--text-primary)" }}>{metaInfo.browserOS}</strong></div>
                        <div><span style={{ color: "var(--text-muted)" }}>Browser:</span> <strong style={{ color: "var(--text-primary)" }}>{metaInfo.browserName}</strong></div>
                        <div><span style={{ color: "var(--text-muted)" }}>GPU Model:</span> <strong style={{ color: "var(--text-primary)" }}>{metaInfo.browserGPU}</strong></div>
                        <div><span style={{ color: "var(--text-muted)" }}>System Hardware:</span> <strong style={{ color: "var(--text-primary)" }}>{metaInfo.browserCores} cores, {metaInfo.browserMemory}</strong></div>
                        <div style={{ gridColumn: "span 2" }}><span style={{ color: "var(--text-muted)" }}>Display Config:</span> <strong style={{ color: "var(--text-primary)" }}>{metaInfo.browserScreen}</strong></div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Bug details */}
                <div className="form-group">
                  <label className="form-label" htmlFor="bugs">Bugs / Issues Found</label>
                  <textarea id="bugs" className="form-input form-textarea" placeholder="E.g., App crashed when clicking payment button (optional)" value={bugs} onChange={(e) => setBugs(e.target.value)} />
                </div>

                {/* Usability feedback */}
                <div className="form-group">
                  <label className="form-label" htmlFor="suggestions">Suggestions for Improvement</label>
                  <textarea id="suggestions" className="form-input form-textarea" placeholder="E.g., Navigation is slightly confusing (optional)" value={suggestions} onChange={(e) => setSuggestions(e.target.value)} />
                </div>

                <button type="submit" className="btn btn-primary btn-lg" style={{ width: "100%" }} disabled={loading || !screenshot}>
                  {loading ? "Processing..." : "✓ Submit Feedback & Proof"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
