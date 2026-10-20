import crypto from 'crypto';
import { getServiceRoleClient } from './supabase/server';

/**
 * Generates a privacy-friendly salted hash with daily rotation.
 * SHA256(ip + SERVER_ANALYTICS_SALT + YYYY-MM-DD)
 * Cannot be reversed and does not allow cross-day tracking.
 */
export function getDailyRotatedVisitorHash(ip: string): string {
  const salt = process.env.SERVER_ANALYTICS_SALT || 'default-salt-value';
  const today = new Date().toISOString().slice(0, 10);
  return crypto
    .createHash('sha256')
    .update(`${ip}:${salt}:${today}`)
    .digest('hex');
}

/**
 * Normalizes User-Agent into a broad device category. Raw user-agent is NEVER stored.
 */
export function parseDeviceType(userAgent?: string | null): 'mobile' | 'tablet' | 'desktop' {
  if (!userAgent) return 'desktop';
  const ua = userAgent.toLowerCase();
  if (/(ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk|(puffin(?!.*(IP|AP|WP))))/.test(ua)) {
    return 'tablet';
  }
  if (/(mobi|ipod|phone|blackberry|opera mini|fennec|minimo|symbian|psp|nintendo ds)/.test(ua)) {
    return 'mobile';
  }
  return 'desktop';
}

/**
 * Records a page view with daily unique visitor deduplication.
 */
export async function trackPageView(params: {
  ip: string;
  path: string;
  placeId?: string;
  userAgent?: string | null;
}) {
  try {
    const supabase = getServiceRoleClient();
    const visitorHash = getDailyRotatedVisitorHash(params.ip);
    const deviceType = parseDeviceType(params.userAgent);
    const today = new Date().toISOString().slice(0, 10);

    await supabase
      .from('analytics_daily_visitors')
      .upsert(
        {
          visit_date: today,
          visitor_hash: visitorHash,
          device_type: deviceType,
          path: params.path,
          place_id: params.placeId || null,
        },
        { onConflict: 'visit_date,visitor_hash,path', ignoreDuplicates: true }
      );
  } catch (err: unknown) {
    console.error('[Analytics] Failed to track page view:', err);
  }
}

/**
 * Logs a search query for craving trend analysis and zero-result alerts.
 */
export async function logSearchQuery(params: {
  query: string;
  searchType: 'keyword' | 'semantic' | 'location';
  resultsCount: number;
}) {
  try {
    const supabase = getServiceRoleClient();
    await supabase.from('search_logs').insert({
      query: params.query.trim().slice(0, 200),
      search_type: params.searchType,
      results_count: params.resultsCount,
    });
  } catch (err: unknown) {
    console.error('[Analytics] Failed to log search query:', err);
  }
}
