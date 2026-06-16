// Per-account daily rate limit for AI extraction. AI Gateway's own rate limiting
// is gateway-wide, so this provides per-user fairness / abuse protection on top.
// Backed by the BOT_INFO KV namespace; counts are best-effort (KV is eventually
// consistent), which is acceptable for a soft daily cap.

const DAY_SECONDS = 60 * 60 * 24

const dayKey = (accountId: string): string => {
  const day = new Date().toISOString().slice(0, 10) // YYYY-MM-DD (UTC)
  return `ai-ratelimit:${accountId}:${day}`
}

// Increments the account's usage for today and reports whether it was allowed.
// When over the limit, the counter is left untouched so it can't grow unbounded.
export const consumeAiQuota = async (
  kv: KVNamespace,
  accountId: string,
  limitPerDay: number,
): Promise<{ allowed: boolean; remaining: number }> => {
  if (limitPerDay <= 0) return { allowed: true, remaining: Infinity }

  const key = dayKey(accountId)
  const used = Number((await kv.get(key)) ?? "0")

  if (used >= limitPerDay) return { allowed: false, remaining: 0 }

  // TTL slightly over a day so the key self-expires after the window.
  await kv.put(key, String(used + 1), { expirationTtl: DAY_SECONDS + 3600 })
  return { allowed: true, remaining: limitPerDay - used - 1 }
}
