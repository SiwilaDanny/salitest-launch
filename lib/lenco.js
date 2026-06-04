const LENCO_BASE = process.env.LENCO_BASE_URL || "https://api.lenco.co/access/v2";
const LENCO_KEY = process.env.LENCO_API_KEY;

export function normalizePhone(phone) {
  let p = phone.replace(/\D/g, "");

  if (p.startsWith("0")) p = "260" + p.slice(1);
  if (p.length === 9) p = "260" + p;

  return p;
}

export async function initiateMobileMoneyPayment({
  amount,
  phone,
  operator,
  reference,
}) {
  const res = await fetch(`${LENCO_BASE}/collections/mobile-money`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LENCO_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount,
      phone: normalizePhone(phone),
      operator,
      currency: "ZMW",
      reference,
      country: "zm",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(err);
  }

  return res.json();
}

export async function verifyPayment(reference) {
  const res = await fetch(`${LENCO_BASE}/collections/status/${reference}`, {
    headers: {
      Authorization: `Bearer ${LENCO_KEY}`,
    },
  });

  if (!res.ok) throw new Error("Verification failed");

  return res.json();
}

export async function initiatePayout({
  amount,
  currency = "ZMW",
  bankCode,
  accountNumber,
  accountName,
  reference,
  narration,
}) {
  const res = await fetch(`${LENCO_BASE}/payouts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LENCO_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount,
      currency,
      bank_code: bankCode,
      account_number: accountNumber,
      account_name: accountName,
      reference,
      narration,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(err);
  }

  return res.json();
}

export function generateReference(prefix = "SALI") {
  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase()}`;
}

export function validateWebhookSignature(payload, signature) {
  const crypto = require("crypto");
  const secret = process.env.LENCO_WEBHOOK_SECRET;
  if (!secret) {
    console.warn("LENCO_WEBHOOK_SECRET not set, skipping signature validation");
    return true;
  }
  
  const expectedHex = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  const expectedBase64 = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("base64");

  return (
    expectedHex.toLowerCase() === signature.toLowerCase() ||
    expectedBase64 === signature
  );
}
