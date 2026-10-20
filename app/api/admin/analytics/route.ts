import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';

function verifyAdmin(request: NextRequest): boolean {
  const token = request.headers.get('x-admin-token') || request.cookies.get('admin_token')?.value;
  const expected = process.env.ADMIN_ACCESS_TOKEN || 'admin123';
  return !!token && token === expected;
}

export async function GET(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServiceRoleClient();

  try {
    // 1. Daily visitors (last 14 days)
    const { data: dailyVisitors } = await supabase
      .from('analytics_daily_visitors')
      .select('visit_date, device_type')
      .gte('visit_date', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));

    // Aggregate daily counts
    const dailyMap: Record<string, { date: string; visitors: number; mobile: number; desktop: number }> = {};
    (dailyVisitors || []).forEach((row) => {
      const d = row.visit_date;
      if (!dailyMap[d]) {
        dailyMap[d] = { date: d, visitors: 0, mobile: 0, desktop: 0 };
      }
      dailyMap[d].visitors += 1;
      if (row.device_type === 'mobile' || row.device_type === 'tablet') {
        dailyMap[d].mobile += 1;
      } else {
        dailyMap[d].desktop += 1;
      }
    });

    const visitorsTimeline = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

    // 2. Search query logs & zero-result detection
    const { data: searches } = await supabase
      .from('search_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    const queryFrequency: Record<string, { query: string; count: number; search_type: string }> = {};
    const zeroResults: Array<{ query: string; search_type: string; created_at: string }> = [];

    (searches || []).forEach((s) => {
      const qLower = s.query.toLowerCase().trim();
      if (!queryFrequency[qLower]) {
        queryFrequency[qLower] = { query: s.query, count: 0, search_type: s.search_type };
      }
      queryFrequency[qLower].count += 1;

      if (s.results_count === 0) {
        zeroResults.push({ query: s.query, search_type: s.search_type, created_at: s.created_at });
      }
    });

    const topSearches = Object.values(queryFrequency)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // 3. Overall counts
    const { count: totalPlaces } = await supabase.from('places').select('*', { count: 'exact', head: true });
    const { count: pendingReviews } = await supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('status', 'pending');
    const { count: approvedReviews } = await supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('status', 'approved');
    const { count: pendingSuggestions } = await supabase.from('place_suggestions').select('*', { count: 'exact', head: true }).eq('status', 'pending');

    return NextResponse.json({
      summary: {
        totalPlaces: totalPlaces || 0,
        approvedReviews: approvedReviews || 0,
        pendingReviews: pendingReviews || 0,
        pendingSuggestions: pendingSuggestions || 0,
        totalUniqueVisitsLogged: dailyVisitors?.length || 0,
      },
      visitorsTimeline,
      topSearches,
      zeroResults: zeroResults.slice(0, 15),
    });
  } catch (err: unknown) {
    console.error('[Admin Analytics] Error:', err);
    return NextResponse.json({ error: 'Failed to aggregate analytics' }, { status: 500 });
  }
}
