import exifr from "exifr";
import crypto from "crypto";
import { createClient } from "../supabase/server";
import { resolveDeviceName } from "./models";

/**
 * Parses and verifies an uploaded screenshot
 *
 * @param {Buffer} buffer - The uploaded image binary buffer
 * @param {string} testerId - The tester profile UUID
 * @param {string} campaignId - The campaign UUID
 * @returns {Promise<{
 *   isValid: boolean,
 *   metadata: object,
 *   fraudFlags: string[],
 *   hash: string
 * }>}
 */
export async function verifyScreenshot(buffer, testerId, campaignId) {
  const flags = [];
  let metadata = {};

  // 1. Generate SHA-256 binary hash
  const hash = crypto.createHash("sha256").update(buffer).digest("hex");

  // 2. Parse image metadata using exifr
  try {
    const rawMeta = await exifr.parse(buffer, {
      tiff: true,
      xmp: true,
      gps: true,
      exif: true,
    });

    if (rawMeta) {
      const rawModel = rawMeta.Model ?? null;
      const friendlyModel = rawModel ? resolveDeviceName(rawModel) : null;

      metadata = {
        make: rawMeta.Make ?? null,
        model: friendlyModel,
        rawModel: rawModel,
        software: rawMeta.Software ?? null,
        takenAt: rawMeta.DateTimeOriginal ?? rawMeta.CreateDate ?? null,
        width: rawMeta.ExifImageWidth ?? rawMeta.ImageWidth ?? null,
        height: rawMeta.ExifImageHeight ?? rawMeta.ImageHeight ?? null,
        raw: rawMeta,
      };
    }
  } catch (err) {
    console.warn("Could not extract EXIF metadata:", err.message);
  }

  // 3. Connect to database for verification checks
  const supabase = await createClient();

  // ── CHECK 1: Duplicate Hash Detection (Collusion Check)
  const { data: duplicateHashes } = await supabase
    .from("feedback_screenshots")
    .select("tester_id, id")
    .eq("file_hash", hash);

  if (duplicateHashes && duplicateHashes.length > 0) {
    const isShared = duplicateHashes.some((h) => h.tester_id !== testerId);
    if (isShared) {
      flags.push("duplicate_screenshot_shared");
    }
  }

  // ── CHECK 2: Temporal Anomaly Check
  if (metadata.takenAt) {
    const takenTime = new Date(metadata.takenAt).getTime();
    const now = Date.now();
    const oneDayInMs = 24 * 60 * 60 * 1000;

    // Screenshot taken in future or more than 7 days ago
    if (takenTime > now + 300000) { // 5-minute clock drift margin
      flags.push("screenshot_timestamp_future");
    } else if (now - takenTime > 7 * oneDayInMs) {
      flags.push("screenshot_timestamp_stale");
    }
  }

  // ── CHECK 3: Device Integrity Profile Check
  const { data: testerProfile } = await supabase
    .from("profiles")
    .select("trust_score")
    .eq("id", testerId)
    .single();

  const { data: testerDevices } = await supabase
    .from("tester_devices")
    .select("device_name, os, device_fingerprint, last_seen_at")
    .eq("tester_id", testerId);

  if (metadata.model && testerDevices && testerDevices.length > 0) {
    const matchedDevice = testerDevices.some((dev) =>
      metadata.model.toLowerCase().includes(dev.device_name?.toLowerCase() ?? "") ||
      dev.device_name?.toLowerCase().includes(metadata.model.toLowerCase())
    );

    if (!matchedDevice) {
      flags.push("device_model_mismatch");
    }
  }

  // ── CHECK 4: Shared Device / Multi-accounting Check
  let activeFingerprint = null;
  if (testerDevices && testerDevices.length > 0) {
    let matchedDeviceObj = null;
    if (metadata.model) {
      matchedDeviceObj = testerDevices.find((dev) =>
        metadata.model.toLowerCase().includes(dev.device_name?.toLowerCase() ?? "") ||
        dev.device_name?.toLowerCase().includes(metadata.model.toLowerCase())
      );
    }
    
    const primaryDevice = matchedDeviceObj || [...testerDevices].sort((a, b) => 
      new Date(b.last_seen_at || 0) - new Date(a.last_seen_at || 0)
    )[0];

    if (primaryDevice?.device_fingerprint) {
      activeFingerprint = primaryDevice.device_fingerprint;
    }
  }

  if (activeFingerprint) {
    const { data: sharedDevices } = await supabase
      .from("tester_devices")
      .select("tester_id")
      .eq("device_fingerprint", activeFingerprint);

    if (sharedDevices && sharedDevices.length > 1) {
      const isShared = sharedDevices.some((d) => d.tester_id !== testerId);
      if (isShared) {
        flags.push("shared_device_detected");
      }
    }
  }

  // 4. Log fraud events if any indicators triggered
  if (flags.length > 0) {
    const fraudScoreDeduction = flags.reduce((sum, f) => {
      if (f === "duplicate_screenshot_shared") return sum + 30; // Critical collusion
      if (f === "shared_device_detected") return sum + 20;      // Shared device / multi-account
      if (f === "device_model_mismatch") return sum + 15;
      if (f === "screenshot_timestamp_stale") return sum + 10;
      return sum + 5;
    }, 0);

    const currentScore = testerProfile?.trust_score ?? 50;
    const newScore = Math.max(0, currentScore - fraudScoreDeduction);

    // Update profile score
    await supabase
      .from("profiles")
      .update({ trust_score: newScore })
      .eq("id", testerId);

    // Insert to audit log
    const fraudLogs = flags.map((flag) => ({
      user_id: testerId,
      event_type: flag,
      severity: flag === "duplicate_screenshot_shared" ? "critical" : 
                flag === "shared_device_detected" ? "high" : "high",
      details: {
        hash,
        campaignId,
        metadata: {
          make: metadata.make,
          model: metadata.model,
          takenAt: metadata.takenAt,
          activeFingerprint
        },
      },
    }));

    await supabase.from("fraud_events").insert(fraudLogs);
  }

  return {
    isValid: flags.length === 0,
    metadata,
    fraudFlags: flags,
    hash,
  };
}
