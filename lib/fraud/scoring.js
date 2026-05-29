/**
 * Fraud scoring engine — SaLiTeSt Launch
 *
 * Trust Score (0–100) is computed from 5 signal categories.
 * Testers below 30 are auto-rejected; 30–50 go to manual review.
 */

const WEIGHTS = {
  deviceLegitimacy: 0.25,   // device fingerprint quality
  networkReputation: 0.15,  // IP/VPN/proxy signals
  behavioralConsistency: 0.20, // interaction patterns
  feedbackQuality: 0.15,    // past feedback depth
  historicalReliability: 0.25, // account age, completion rate
};

/**
 * @param {object} signals
 * @param {object} signals.device  - { isEmulator, isVpn, isDatacenter, isBot }
 * @param {object} signals.network - { vpnDetected, datacenterIp, knownBadIp }
 * @param {object} signals.behavior - { rapidFormFill, noScrollEvents, linearMouse, botLikeTiming }
 * @param {object} signals.feedback - { avgQualityScore, totalFeedback, genericCount }
 * @param {object} signals.history  - { accountAgeDays, completedCampaigns, dropRate }
 * @returns {{ score: number, breakdown: object, recommendation: string }}
 */
export function computeTrustScore(signals) {
  const { device, network, behavior, feedback, history } = signals;

  // ── Device Legitimacy (0–100)
  let deviceScore = 100;
  if (device?.isEmulator)   deviceScore -= 60;
  if (device?.isBot)        deviceScore -= 80;
  if (device?.isVpn)        deviceScore -= 20;
  if (device?.isDatacenter) deviceScore -= 40;
  deviceScore = Math.max(0, deviceScore);

  // ── Network Reputation (0–100)
  let networkScore = 100;
  if (network?.vpnDetected)    networkScore -= 25;
  if (network?.datacenterIp)   networkScore -= 50;
  if (network?.knownBadIp)     networkScore -= 80;
  networkScore = Math.max(0, networkScore);

  // ── Behavioral Consistency (0–100)
  let behaviorScore = 100;
  if (behavior?.rapidFormFill) behaviorScore -= 30;
  if (behavior?.noScrollEvents) behaviorScore -= 20;
  if (behavior?.linearMouse)   behaviorScore -= 25;
  if (behavior?.botLikeTiming) behaviorScore -= 40;
  behaviorScore = Math.max(0, behaviorScore);

  // ── Feedback Quality (0–100)
  let feedbackScore = 70; // neutral default for new testers
  if (feedback?.totalFeedback > 0) {
    feedbackScore = feedback.avgQualityScore ?? 70;
    const genericPenalty = Math.min(50, (feedback.genericCount / feedback.totalFeedback) * 100 * 0.5);
    feedbackScore = Math.max(0, feedbackScore - genericPenalty);
  }

  // ── Historical Reliability (0–100)
  let historyScore = 50; // neutral for new accounts
  if (history?.accountAgeDays !== undefined) {
    historyScore = Math.min(100, (history.accountAgeDays / 30) * 20 + 50);
    if (history.completedCampaigns > 0) {
      historyScore = Math.min(100, historyScore + history.completedCampaigns * 5);
    }
    if (history.dropRate > 0.5) {
      historyScore = Math.max(0, historyScore - 30);
    }
  }

  // ── Weighted Score
  const score = Math.round(
    deviceScore   * WEIGHTS.deviceLegitimacy +
    networkScore  * WEIGHTS.networkReputation +
    behaviorScore * WEIGHTS.behavioralConsistency +
    feedbackScore * WEIGHTS.feedbackQuality +
    historyScore  * WEIGHTS.historicalReliability
  );

  const recommendation =
    score >= 50 ? "approve" :
    score >= 30 ? "manual_review" :
    "reject";

  return {
    score,
    breakdown: { deviceScore, networkScore, behaviorScore, feedbackScore, historyScore },
    recommendation,
  };
}

/**
 * Derive fraud flags as an array of human-readable strings.
 */
export function getFraudFlags(signals) {
  const flags = [];
  const { device, network, behavior } = signals;
  if (device?.isEmulator)      flags.push("Emulator detected");
  if (device?.isBot)           flags.push("Bot fingerprint detected");
  if (device?.isVpn)           flags.push("VPN/proxy detected");
  if (device?.isDatacenter)    flags.push("Data center IP");
  if (network?.knownBadIp)     flags.push("Known malicious IP");
  if (behavior?.rapidFormFill) flags.push("Rapid form completion");
  if (behavior?.noScrollEvents) flags.push("No scroll events");
  if (behavior?.linearMouse)   flags.push("Linear mouse movement (bot pattern)");
  if (behavior?.botLikeTiming) flags.push("Bot-like interaction timing");
  return flags;
}

/**
 * Map a score to a severity label for fraud events.
 */
export function scoreToSeverity(score) {
  if (score < 20) return "critical";
  if (score < 35) return "high";
  if (score < 50) return "medium";
  return "low";
}
