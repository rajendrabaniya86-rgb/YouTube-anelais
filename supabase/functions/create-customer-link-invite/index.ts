import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function respond(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function encodeBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `\\x${hex}`;
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return respond(405, { error: "केवल POST अनुरोध स्वीकार है।" });

  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return respond(401, { error: "लॉगिन आवश्यक है।" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return respond(500, { error: "सर्वर कॉन्फ़िगरेशन अधूरा है।" });
  }

  try {
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    const user = authData?.user;
    if (authError || !user) return respond(401, { error: "लॉगिन सत्यापित नहीं हो सका।" });

    const input = await request.json();
    const shopId = typeof input.shopId === "string" ? input.shopId : "";
    const customerId = typeof input.customerId === "string" ? input.customerId : "";
    const hours = input.expiresInHours === undefined ? 24 : Number(input.expiresInHours);
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(shopId) || !uuidPattern.test(customerId)) {
      return respond(400, { error: "दुकान या ग्राहक रिकॉर्ड की पहचान सही नहीं है।" });
    }
    if (!Number.isInteger(hours) || hours < 1 || hours > 72) {
      return respond(400, { error: "कोड की समय-सीमा 1 से 72 घंटे के बीच रखें।" });
    }

    // Verify ownership using the caller's JWT and existing RLS boundary.
    const { data: shop, error: shopError } = await userClient
      .from("shops").select("id").eq("id", shopId).eq("owner_id", user.id).maybeSingle();
    if (shopError || !shop) return respond(403, { error: "इस दुकान की अनुमति सत्यापित नहीं हुई।" });

    const { data: customer, error: customerError } = await userClient
      .from("customers").select("id").eq("id", customerId).eq("shop_id", shopId).maybeSingle();
    if (customerError || !customer) return respond(404, { error: "इस दुकान का ग्राहक रिकॉर्ड नहीं मिला।" });

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const random = new Uint8Array(32);
    crypto.getRandomValues(random);
    const inviteCode = encodeBase64Url(random);
    const tokenHash = await sha256(inviteCode);
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

    const { error: insertError } = await admin.rpc("create_customer_link_invite_atomic", {
      p_shop_id: shopId,
      p_customer_id: customerId,
      p_created_by: user.id,
      p_token_hash: tokenHash,
      p_expires_at: expiresAt,
    });
    if (insertError) {
      if (insertError.message?.includes("INVITE_RATE_LIMIT")) {
        return respond(429, { error: "एक घंटे में अधिकतम 10 निमंत्रण बनाए जा सकते हैं।" });
      }
      return respond(500, { error: "निमंत्रण सुरक्षित रूप से सेव नहीं हो सका।" });
    }

    // Show the raw code once. It is never written to the database or logs.
    return respond(200, {
      inviteCode,
      expiresAt,
      message: "यह कोड केवल एक बार दिखाया जाएगा। अभी इससे कोई लेजर या बैलेंस साझा नहीं होता।",
    });
  } catch {
    return respond(400, { error: "अनुरोध पढ़ा नहीं जा सका।" });
  }
});
