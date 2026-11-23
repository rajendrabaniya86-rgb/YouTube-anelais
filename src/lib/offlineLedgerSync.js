import { centsOf } from './ledgerMath.js';
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
  let amountCents = 0;
  try { amountCents = centsOf(amount); } catch {}
  if (!Number.isFinite(amount) || amountCents <= 0 || amountCents > 99999999999999 ||
      !['credit', 'payment'].includes(draft.type)) {
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


const DEFAULT_RETRY_ATTEMPTS = 3;
const DEFAULT_RETRY_BASE_DELAY_MS = 300;
const DEFAULT_RETRY_MAX_DELAY_MS = 3000;

function isRetryableLedgerError(error) {
  const code = String(error?.code || '');
  const status = Number(error?.status || error?.statusCode || error?.context?.status || 0);
  const message = String(error?.message || '').toLowerCase();
  if (error?.name === 'AbortError' || error?.name === 'TimeoutError') return true;
  if (['408', '429', '500', '502', '503', '504'].includes(String(status))) return true;
  if (/^(08|40)/.test(code) || ['55P03', '57014'].includes(code)) return true;
  return /failed to fetch|network request failed|fetch failed|connection reset|timed out|timeout|temporarily unavailable|socket hang up/.test(message);
}

/**
 * Bounded retry wrapper for transient transport/database failures only.
 * Validation, authentication, permission, and payload-conflict errors are not retried.
 * The underlying sync function retains client_ref idempotency for ambiguous commits.
 */
export async function syncOfflineLedgerDraftWithRetry(
  client, shopId, userId, draft,
  { maxAttempts = DEFAULT_RETRY_ATTEMPTS, baseDelayMs = DEFAULT_RETRY_BASE_DELAY_MS,
    maxDelayMs = DEFAULT_RETRY_MAX_DELAY_MS, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {},
) {
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 5 ||
      !Number.isFinite(baseDelayMs) || baseDelayMs < 0 ||
      !Number.isFinite(maxDelayMs) || maxDelayMs < 0) {
    throw new Error('Retry configuration is invalid.');
  }
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await syncOfflineLedgerDraftWithClient(client, shopId, userId, draft);
    } catch (error) {
      if (!isRetryableLedgerError(error) || attempt === maxAttempts) {
        if (isRetryableLedgerError(error) && attempt === maxAttempts) {
          error.retryExhausted = true;
          error.retryAttempts = attempt;
        }
        throw error;
      }
      const delay = Math.min(baseDelayMs * (2 ** (attempt - 1)), maxDelayMs);
      await sleep(delay);
    }
  }
  throw new Error('Offline ledger retry ended unexpectedly.');
}
