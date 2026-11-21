import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function maskPhone(value: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length < 4) return "••••";
  return `•••• ${digits.slice(-4)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json({ error: "Server configuration unavailable" }, 500);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) return json({ error: "Unauthorized" }, 401);

  let body: { shopId?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request" }, 400);
  }

  if (typeof body.shopId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.shopId)) {
    return json({ error: "Invalid request" }, 400);
  }

  // Check ownership with the caller's JWT before using the service-role client.
  const { data: ownedShop, error: shopError } = await userClient
    .from("shops")
    .select("id")
    .eq("id", body.shopId)
    .eq("owner_id", authData.user.id)
    .maybeSingle();

  if (shopError || !ownedShop) return json({ error: "Shop not found" }, 404);

  const { data: claims, error: claimsError } = await admin
    .from("customer_link_claims")
    .select("id, customer_id, submitted_at, status")
    .eq("shop_id", body.shopId)
    .eq("status", "pending")
    .order("submitted_at", { ascending: true })
    .limit(50);

  if (claimsError) return json({ error: "Could not load claims" }, 500);
  if (!claims?.length) return json({ claims: [] });

  const customerIds = [...new Set(claims.map((claim) => claim.customer_id))];
  const { data: customers, error: customersError } = await admin
    .from("customers")
    .select("id, display_name, phone")
    .eq("shop_id", body.shopId)
    .in("id", customerIds);

  if (customersError) return json({ error: "Could not load claims" }, 500);

  const customerMap = new Map((customers ?? []).map((customer) => [customer.id, customer]));
  const safeClaims = claims.map((claim) => {
    const customer = customerMap.get(claim.customer_id);
    return {
      id: claim.id,
      submittedAt: claim.submitted_at,
      status: claim.status,
      customer: customer
        ? { displayName: customer.display_name, phoneMasked: maskPhone(customer.phone) }
        : null,
    };
  });

  return json({ claims: safeClaims });
});
