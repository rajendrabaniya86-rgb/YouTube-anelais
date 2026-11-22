/**
 * Service-layer implementation for syncing one offline ledger draft.
 * The client is injected so the exact production path can be tested without
 * touching a real Supabase project.
 */
export async function syncOfflineLedgerDraftWithClient(client, shopId, userId, draft) {
  if (!client) throw new Error('Supabase कनेक्ट नहीं है।');
  if (!shopId || !userId || draft?.shopId !== shopId || draft?.userId !== userId || !draft?.id || !draft?.customerId) {
    throw new Error('ऑफलाइन ड्राफ्ट का खाता मेल नहीं खाता।');
  }
  const amount = Number(draft.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 999999999999.99 ||
      Math.round(amount * 100) !== amount * 100 || !['credit', 'payment'].includes(draft.type)) {
    throw new Error('ऑफलाइन ड्राफ्ट की रकम या प्रकार सही नहीं है।');
  }

  const payload = {
    shop_id: shopId,
    customer_id: draft.customerId,
    created_by: userId,
    entry_type: draft.type,
    amount,
    note: String(draft.note || '').trim(),
    client_ref: draft.id,
  };
  const columns = 'id,shop_id,customer_id,entry_type,amount,note,created_at,created_by,client_ref';
  const { data, error } = await client.from('ledger_entries').insert(payload).select(columns).single();
  if (!error) return { row: data, outcome: 'inserted' };
  if (error.code !== '23505') throw error;

  // The original request may have committed while its response was lost.
  const { data: existing, error: lookupError } = await client.from('ledger_entries')
    .select(columns).eq('shop_id', shopId).eq('client_ref', draft.id).maybeSingle();
  if (lookupError) throw lookupError;
  if (!existing) throw error;

  const matches = existing.customer_id === draft.customerId &&
    existing.created_by === userId &&
    existing.entry_type === draft.type &&
    Number(existing.amount) === amount &&
    String(existing.note || '') === String(draft.note || '').trim();
  if (!matches) {
    throw new Error('इस ड्राफ्ट की ID पहले से अलग लेन-देन में मिली। ड्राफ्ट सुरक्षित रखा गया है, जाँच जरूरी है।');
  }
  return { row: existing, outcome: 'already_synced' };
}
