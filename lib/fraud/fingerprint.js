/**
 * Generates a stable hardware-bound signature as a fallback.
 */
async function getCustomHardwareFingerprint() {
  if (typeof window === "undefined") return null;

  try {
    const ua = navigator.userAgent || "";
    const screenWidth = window.screen.width || 0;
    const screenHeight = window.screen.height || 0;
    const colorDepth = window.screen.colorDepth || 0;
    const pixelRatio = window.devicePixelRatio || 1;
    
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    const language = navigator.language || "";
    const cores = navigator.hardwareConcurrency || 0;
    const memory = navigator.deviceMemory || 0;

    let gpu = "";
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      if (gl) {
        const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
        if (debugInfo) {
          gpu = gl.getParameter(debugInfo.UNMASKED_RENDERER_RENDERER_ID) || "";
        }
      }
    } catch (e) {}

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

    const payload = [
      os, browser, gpu, cores, memory,
      `${screenWidth}x${screenHeight}`, colorDepth, pixelRatio, timezone, language
    ].join("|");

    const encoder = new TextEncoder();
    const data = encoder.encode(payload);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const fingerprint = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

    return {
      fingerprint,
      deviceName: `${os} (${browser})`,
      os,
      browser,
      screenResolution: `${screenWidth}x${screenHeight}`,
      isEmulator: (os === "Android" && (gpu.includes("SwiftShader") || gpu.includes("Bluestacks"))),
      isBot: /bot|googlebot|crawler|spider|robot|crawling/i.test(ua) || navigator.webdriver
    };
  } catch (err) {
    console.error("Hardware fingerprint fallback failed:", err);
    return null;
  }
}

/**
 * Generates a device fingerprint.
 * Uses Fingerprint.com (FingerprintJS Pro) if available, with a robust hardware fallback.
 *
 * @returns {Promise<{
 *   fingerprint: string,
 *   deviceName: string,
 *   os: string,
 *   browser: string,
 *   screenResolution: string,
 *   isEmulator: boolean,
 *   isBot: boolean
 * }|null>}
 */
export async function getDeviceFingerprint() {
  if (typeof window === "undefined") return null;

  try {
    const apiKey = process.env.NEXT_PUBLIC_FINGERPRINTJS_API_KEY || "5Dwt0XZMRxXlt9WqTY0F";
    
    // Dynamically load Fingerprint.com JS agent from their secure CDN
    const FingerprintJS = await import(/* webpackIgnore: true */ `https://fpjscdn.net/v4/${apiKey}`)
      .then((m) => m.default || m);
    
    const fp = await FingerprintJS.load();
    const result = await fp.get();
    
    if (result && result.visitorId) {
      const ua = navigator.userAgent || "";
      const screenWidth = window.screen.width || 0;
      const screenHeight = window.screen.height || 0;

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

      return {
        fingerprint: result.visitorId,
        deviceName: `${os} (${browser})`,
        os,
        browser,
        screenResolution: `${screenWidth}x${screenHeight}`,
        isEmulator: false,
        isBot: /bot|googlebot|crawler|spider|robot|crawling/i.test(ua) || navigator.webdriver
      };
    }
    
    return getCustomHardwareFingerprint();
  } catch (err) {
    console.warn("Fingerprint.com script failed or blocked. Using hardware fallback:", err.message);
    return getCustomHardwareFingerprint();
  }
}
