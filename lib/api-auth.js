import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

// Initialize admin client to bypass RLS when looking up keys
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Middleware helper to verify an API key from an incoming request.
 * Extracts the Bearer token, hashes it, and looks it up in the api_keys table.
 * 
 * @param {Request} request 
 * @returns {Promise<{ developer_id: string | null, error: string | null }>}
 */
export async function verifyApiKey(request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return { developer_id: null, error: "Missing or malformed Authorization header. Use 'Bearer <api_key>'." };
    }

    const rawKey = authHeader.split(" ")[1];
    if (!rawKey) {
      return { developer_id: null, error: "Empty API key provided." };
    }

    // Hash the provided key to match against the DB
    const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

    const { data: apiKey, error } = await supabaseAdmin
      .from("api_keys")
      .select("id, developer_id")
      .eq("key_hash", keyHash)
      .single();

    if (error || !apiKey) {
      return { developer_id: null, error: "Invalid API key." };
    }

    // Async update last_used_at (fire and forget so we don't block the request)
    supabaseAdmin
      .from("api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", apiKey.id)
      .then();

    return { developer_id: apiKey.developer_id, error: null };
  } catch (err) {
    console.error("API Key Verification Error:", err);
    return { developer_id: null, error: "Internal server error during authentication." };
  }
}
