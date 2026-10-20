import { getServiceRoleClient } from './supabase/server';

/**
 * Atomic Postgres-backed rate limiter using pinchaat.check_rate_limit stored procedure.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; error?: string }> {
  try {
    const supabase = getServiceRoleClient();
    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });

    if (error) {
      console.error('[RateLimit] DB check error:', error.message);
      // Fail open defensively if DB RPC temporarily unavailable, but log warning
      return { allowed: true };
    }

    return { allowed: !!data };
  } catch (err: unknown) {
    console.error('[RateLimit] Unexpected error:', err);
    return { allowed: true };
  }
}

/**
 * Checks and increments the global daily Gemini API quota counter.
 * Default max 1,000 calls per day.
 */
export async function checkGlobalGeminiDailyCap(maxDailyCalls: number = 1000): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const key = `gemini_global_daily:${today}`;
  const { allowed } = await checkRateLimit(key, maxDailyCalls, 86400);
  return allowed;
}

/**
 * Semantic search rate limit: Max 8 queries per minute per client IP.
 */
export async function checkSemanticSearchRateLimit(ip: string): Promise<boolean> {
  const key = `semantic_search:${ip}`;
  const { allowed } = await checkRateLimit(key, 8, 60);
  return allowed;
}

/**
 * Public submission rate limit (Reviews & Place Suggestions): Max 3 per 10 minutes per IP.
 */
export async function checkSubmissionRateLimit(ip: string): Promise<boolean> {
  const key = `submission:${ip}`;
  const { allowed } = await checkRateLimit(key, 3, 600);
  return allowed;
}
