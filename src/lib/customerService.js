import { supabase } from './supabase';
export async function listCustomers() {
 if (!supabase) throw new Error('Supabase कनेक्ट नहीं है।');
 const {data:shops,error:se}=await supabase.from('shops').select('id,shop_name').order('created_at').limit(1);
 if(se) throw se; if(!shops?.length) throw new Error('इस खाते की दुकान नहीं मिली। Supabase migration और दुकान रिकॉर्ड जाँचें।');
 const shop=shops[0];
 const {data,error}=await supabase.from('customers').select('id,shop_id,display_name,phone,notes,created_at').eq('shop_id',shop.id).order('created_at',{ascending:false});
 if(error) throw error;
 const {data:entries,error:ledgerError}=await supabase.from('ledger_entries').select('id,shop_id,customer_id,entry_type,amount,note,created_at').eq('shop_id',shop.id).order('created_at',{ascending:false});
 if(ledgerError) throw ledgerError; return {shop,customers:data||[],entries:entries||[]};
}
export async function addCustomer(shopId,userId,input) {
 const {data,error}=await supabase.from('customers').insert({shop_id:shopId,created_by:userId,display_name:input.name.trim(),phone:input.phone.trim()||null,notes:input.notes.trim()||null}).select('id,shop_id,display_name,phone,notes,created_at').single();
 if(error) throw error; return data;
}
export async function listLedgerEntries(shopId) {
 const {data,error}=await supabase.from('ledger_entries').select('id,shop_id,customer_id,entry_type,amount,note,created_at').eq('shop_id',shopId).order('created_at',{ascending:false});
 if(error) throw error; return data||[];
}
export async function addLedgerEntry(shopId,userId,customerId,input) {
 if(!supabase) throw new Error('Supabase कनेक्ट नहीं है।');
 const amount=Number(input.amount); if(!Number.isFinite(amount)||amount<=0||amount>999999999999.99||Math.round(amount*100)!==amount*100) throw new Error('रकम 0.01 से 999999999999.99 के बीच, अधिकतम दो दशमलव तक होनी चाहिए।');
 const {data,error}=await supabase.from('ledger_entries').insert({shop_id:shopId,customer_id:customerId,created_by:userId,entry_type:input.type,amount,note:(input.note||'').trim()}).select('id,shop_id,customer_id,entry_type,amount,note,created_at').single();
 if(error) throw error; return data;
}

// Idempotent upload for an offline draft. The draft UUID remains stable across retries.
export async function syncOfflineLedgerDraft(shopId,userId,draft) {
 if(!supabase) throw new Error('Supabase कनेक्ट नहीं है।');
 if(!shopId||!userId||draft.shopId!==shopId||draft.userId!==userId||!draft.id||!draft.customerId)
  throw new Error('ऑफलाइन ड्राफ्ट का खाता मेल नहीं खाता।');
 const amount=Number(draft.amount);
 if(!Number.isFinite(amount)||amount<=0||amount>999999999999.99||Math.round(amount*100)!==amount*100||!['credit','payment'].includes(draft.type))
  throw new Error('ऑफलाइन ड्राफ्ट की रकम या प्रकार सही नहीं है।');
 const payload={shop_id:shopId,customer_id:draft.customerId,created_by:userId,
  entry_type:draft.type,amount,note:String(draft.note||'').trim(),client_ref:draft.id};
 const columns='id,shop_id,customer_id,entry_type,amount,note,created_at,created_by,client_ref';
 const {data,error}=await supabase.from('ledger_entries').insert(payload).select(columns).single();
 if(!error) return {row:data,outcome:'inserted'};
 if(error.code!=='23505') throw error;
 // A retry may hit the unique key after the first request succeeded but its response was lost.
 const {data:existing,error:lookupError}=await supabase.from('ledger_entries')
  .select(columns).eq('shop_id',shopId).eq('client_ref',draft.id).maybeSingle();
 if(lookupError) throw lookupError;
 if(!existing) throw error;
 const matches=existing.customer_id===draft.customerId&&existing.created_by===userId&&
  existing.entry_type===draft.type&&Number(existing.amount)===amount&&
  String(existing.note||'')===String(draft.note||'').trim();
 if(!matches) throw new Error('इस ड्राफ्ट की ID पहले से अलग लेन-देन में मिली। ड्राफ्ट सुरक्षित रखा गया है, जाँच जरूरी है।');
 return {row:existing,outcome:'already_synced'};
}

export async function listPaymentReminders(shopId) {
 const {data,error}=await supabase.from('payment_reminders')
  .select('id,shop_id,customer_id,ledger_entry_id,due_at,message,status,created_at,completed_at')
  .eq('shop_id',shopId).order('due_at',{ascending:true});
 if(error) throw error; return data||[];
}
export async function addPaymentReminder(shopId,userId,customerId,input) {
 if(!supabase) throw new Error('Supabase कनेक्ट नहीं है।');
 const dueAt=new Date(input.dueAt);
 if(!Number.isFinite(dueAt.getTime())||dueAt.getTime()<=Date.now()) throw new Error('भविष्य की सही तारीख और समय चुनें।');
 const {data,error}=await supabase.from('payment_reminders').insert({
  shop_id:shopId,created_by:userId,customer_id:customerId,
  due_at:dueAt.toISOString(),message:(input.message||'').trim()
 }).select('id,shop_id,customer_id,due_at,message,status,created_at,completed_at').single();
 if(error) throw error; return data;
}
export async function updatePaymentReminder(id,status) {
 if(!supabase) throw new Error('Supabase कनेक्ट नहीं है।');
 const patch={status,completed_at:status==='completed'?new Date().toISOString():null};
 const {data,error}=await supabase.from('payment_reminders').update(patch).eq('id',id)
  .select('id,shop_id,customer_id,due_at,message,status,created_at,completed_at').single();
 if(error) throw error; return data;
}


/**
 * Read-only shopkeeper view of customer account-link requests.
 * The Edge Function verifies shop ownership before returning masked details.
 */
export async function listPendingCustomerClaims(shopId) {
 if (!supabase) throw new Error('Supabase कनेक्ट नहीं है।');
 if (!shopId) throw new Error('दुकान की जानकारी नहीं मिली।');
 const { data, error } = await supabase.functions.invoke('list-customer-link-claims', {
  body: { shopId }
 });
 if (error) throw error;
 if (!data || !Array.isArray(data.claims)) throw new Error('अनुरोध सूची का जवाब सही नहीं है।');
 return data.claims;
}


/** Create a one-time customer invitation. The raw code is returned once only. */
export async function createCustomerLinkInvite(shopId, customerId, expiresInHours = 24) {
 if (!supabase) throw new Error('Supabase कनेक्ट नहीं है।');
 if (!shopId || !customerId) throw new Error('दुकान और ग्राहक रिकॉर्ड चुनें।');
 if (!Number.isInteger(expiresInHours) || expiresInHours < 1 || expiresInHours > 72) {
  throw new Error('कोड की समय-सीमा 1 से 72 घंटे के बीच रखें।');
 }
 const { data, error } = await supabase.functions.invoke('create-customer-link-invite', {
  body: { shopId, customerId, expiresInHours }
 });
 if (error) throw error;
 if (!data || typeof data.inviteCode !== 'string' || !data.expiresAt) {
  throw new Error('निमंत्रण सेवा से सही जवाब नहीं मिला।');
 }
 return data;
}
