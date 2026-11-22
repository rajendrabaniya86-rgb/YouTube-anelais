import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) return Response.json({ error: 'Authentication required' }, { status: 401, headers: corsHeaders });

    const url = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !anonKey || !serviceKey) throw new Error('Server authentication is not configured.');

    const authClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: authData, error: authError } = await authClient.auth.getUser(token);
    if (authError || !authData.user) return Response.json({ error: 'Invalid session' }, { status: 401, headers: corsHeaders });

    const body = await req.json();
    const accountType = body.accountType === 'customer' ? 'customer' : 'shop_owner';
    const fullName = String(body.fullName || authData.user.user_metadata?.full_name || authData.user.email || '').trim().slice(0, 120);
    const shopName = String(body.shopName || '').trim().slice(0, 120);
    if (accountType === 'shop_owner' && !shopName) {
      return Response.json({ error: 'दुकान का नाम जरूरी है।' }, { status: 400, headers: corsHeaders });
    }

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error: profileError } = await admin.from('profiles').upsert({
      id: authData.user.id,
      full_name: fullName,
      account_type: accountType,
    }, { onConflict: 'id' });
    if (profileError) throw profileError;

    if (accountType === 'shop_owner') {
      const { data: shops, error: shopsError } = await admin.from('shops')
        .select('id, shop_name').eq('owner_id', authData.user.id).order('created_at', { ascending: true });
      if (shopsError) throw shopsError;
      if ((shops || []).length > 1) {
        return Response.json({ error: 'इस खाते में एक से अधिक दुकानें हैं। सहायता की जरूरत है।' }, { status: 409, headers: corsHeaders });
      }
      if (shops?.length === 1) {
        const { error } = await admin.from('shops').update({ shop_name: shopName }).eq('id', shops[0].id).eq('owner_id', authData.user.id);
        if (error) throw error;
      } else {
        const { error } = await admin.from('shops').insert({ owner_id: authData.user.id, shop_name: shopName });
        if (error) throw error;
      }
    }

    return Response.json({ ok: true, accountType }, { status: 200, headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Account setup failed' }, { status: 400, headers: corsHeaders });
  }
});
