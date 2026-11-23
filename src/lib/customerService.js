import { supabase } from './supabase';
import { syncOfflineLedgerDraftWithRetry } from './offlineLedgerSync';
export async function listCustomers(userId) {
 if (!supabase) throw new Error('Supabase कनेक्ट नहीं है।');
 if (!userId) throw new Error('लॉगिन उपयोगकर्ता की जानकारी नहीं मिली।');
 // Explicitly scope the shop lookup to the signed-in owner. RLS is a second
 // enforcement layer, not a substitute for an explicit owner filter.
 const {data:shops,error:se}=await supabase.from('shops')
  .select('id,shop_name').eq('owner_id',userId).order('created_at',{ascending:true});
 if(se) throw se;
 if(!shops?.length) throw new Error('इस लॉगिन खाते की दुकान नहीं मिली।');
 // Do not silently choose the first shop if multi-shop support is added later.
 if(shops.length>1) throw new Error('इस खाते में एक से अधिक दुकानें हैं। सुरक्षित दुकान चयन सुविधा जुड़ने तक लाइव रिकॉर्ड नहीं खोले गए।');
 const shop=shops[0];
 const {data,error}=await supabase.from('customers').select('id,shop_id,display_name,phone,notes,created_at').eq('shop_id',shop.id).order('created_at',{ascending:false});
 if(error) throw error;
 const {data:entries,error:ledgerError}=await supabase.from('ledger_entries').select('id,shop_id,customer_id,entry_type,amount,note,created_at,corrects_entry_id').eq('shop_id',shop.id).order('created_at',{ascending:false});
 if(ledgerError) throw ledgerError; return {shop,customers:data||[],entries:entries||[]};
}
export async function addCustomer(shopId,userId,input) {
 const {data,error}=await supabase.from('customers').insert({shop_id:shopId,created_by:userId,display_name:input.name.trim(),phone:input.phone.trim()||null,notes:input.notes.trim()||null}).select('id,shop_id,display_name,phone,notes,created_at').single();
 if(error) throw error; return data;
}
export async function listLedgerEntries(shopId) {
 const {data,error}=await supabase.from('ledger_entries').select('id,shop_id,customer_id,entry_type,amount,note,created_at,corrects_entry_id').eq('shop_id',shopId).order('created_at',{ascending:false});
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
 return syncOfflineLedgerDraftWithRetry(supabase,shopId,userId,draft);
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
 if(!id||!['pending','completed','cancelled'].includes(status)) throw new Error('रिमाइंडर या उसकी स्थिति सही नहीं है।');
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


 
/** Review a pending claim. The database verifies the signed-in shop owner. */
export async function reviewCustomerLinkClaim(claimId, decision, reviewNote = '') {
 if (!supabase) throw new Error('Supabase कनेक्ट नहीं है।');
 if (!claimId || !['approved', 'rejected'].includes(decision)) {
  throw new Error('अनुरोध या निर्णय सही नहीं है।');
 }
 const { data, error } = await supabase.rpc('review_customer_link_claim', {
  p_claim_id: claimId,
  p_decision: decision,
  p_review_note: String(reviewNote || '').slice(0, 500)
 });
 if (error) throw error;
 if (!data || data.id !== claimId || data.status !== decision || data.ledger_access_granted !== false) {
  throw new Error('सर्वर से सुरक्षित समीक्षा की पुष्टि नहीं मिली।');
 }
 return data;
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


/** Redeem a one-time invitation as the authenticated customer account. */
export async function redeemCustomerLinkInvite(inviteCode) {
 if (!supabase) throw new Error('Supabase कनेक्ट नहीं है।');
 const code=String(inviteCode||'').trim();
 if (!/^[A-Za-z0-9_-]{40,50}$/.test(code)) throw new Error('निमंत्रण कोड सही प्रारूप में लिखें।');
 const { data, error } = await supabase.functions.invoke('redeem-customer-link-invite', {
  body: { inviteCode: code }
 });
 if (error) throw error;
 if (data?.status !== 'pending') throw new Error(data?.error || 'अनुरोध जमा नहीं हो सका।');
 return data;
}
