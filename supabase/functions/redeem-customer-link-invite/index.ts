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

function toByteaHex(hex: string) {
  return `\\x${hex}`;
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return respond(405, { error: "केवल POST अनुरोध स्वीकार है।" });

  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return respond(401, { error: "ग्राहक लॉगिन आवश्यक है।" });

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
    if (authError || !user) return respond(401, { error: "ग्राहक लॉगिन सत्यापित नहीं हुआ।" });

    const input = await request.json();
    const inviteCode = typeof input.inviteCode === "string" ? input.inviteCode.trim() : "";
    if (!/^[A-Za-z0-9_-]{40,50}$/.test(inviteCode)) {
      return respond(400, { error: "निमंत्रण कोड सही प्रारूप में नहीं है।" });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: profile, error: profileError } = await admin
      .from("profiles").select("account_type").eq("id", user.id).maybeSingle();
    if (profileError || profile?.account_type !== "customer") {
      return respond(403, { error: "यह सुविधा केवल ग्राहक खाते के लिए है।" });
    }

    const digest = await sha256Hex(inviteCode);
    const { data: claimId, error: redeemError } = await admin.rpc("redeem_customer_link_invite", {
      p_token_hash: toByteaHex(digest),
      p_customer_user_id: user.id,
    });
    if (redeemError || !claimId) {
      // Same response for unknown, expired, revoked, or already-used codes.
      return respond(400, { error: "कोड मान्य नहीं है, समाप्त हो चुका है या पहले इस्तेमाल हो चुका है।" });
    }

    return respond(200, {
      status: "pending",
      message: "अनुरोध जमा हो गया है। पहचान और रिकॉर्ड की जाँच के बाद ही कोई लिंक मंजूर होगा। अभी दुकान का हिसाब या बैलेंस उपलब्ध नहीं है।",
    });
  } catch {
    return respond(400, { error: "अनुरोध पढ़ा नहीं जा सका।" });
  }
});
