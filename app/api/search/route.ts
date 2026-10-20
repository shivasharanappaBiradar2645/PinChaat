import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { getEmbedding } from '@/lib/gemini';
import { checkSemanticSearchRateLimit } from '@/lib/rate-limit';
import { logSearchQuery } from '@/lib/analytics';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get('q') || '').trim();
  const mode = searchParams.get('mode') || 'semantic'; // 'semantic' | 'keyword'

  if (!query) {
    return NextResponse.json({ results: [] });
  }

  // Get client IP for rate limiting
  const forwardedFor = request.headers.get('x-forwarded-for');
  const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : '127.0.0.1';

  const supabase = getServiceRoleClient();

  if (mode === 'semantic') {
    // 1. Check rate limit
    const allowed = await checkSemanticSearchRateLimit(ip);
    if (!allowed) {
      return NextResponse.json(
        {
          error: 'Semantic search rate limit reached (max 8/min). Try normal keyword search or wait 60s.',
          rateLimited: true,
          fallbackAvailable: true,
        },
        { status: 429 }
      );
    }

    try {
      // 2. Generate embedding for query using RETRIEVAL_QUERY task type & 768 dimensions
      const { embedding } = await getEmbedding(query, 'RETRIEVAL_QUERY');

      // 3. Call hardened match_reviews RPC with service_role client
      const { data: matchedReviews, error: matchError } = await supabase.rpc('match_reviews', {
        query_embedding: embedding,
        match_threshold: 0.35,
        match_count: 10,
      });

      if (matchError) {
        console.error('[Search] match_reviews error:', matchError.message);
        throw matchError;
      }

      if (!matchedReviews || matchedReviews.length === 0) {
        await logSearchQuery({ query, searchType: 'semantic', resultsCount: 0 });
        return NextResponse.json({ results: [], mode: 'semantic' });
      }

      // Collect place IDs from matched reviews
      const placeIds = Array.from(new Set(matchedReviews.map((r: { place_id: string }) => r.place_id)));

      // Fetch the places
      const { data: places, error: placesError } = await supabase
        .from('places')
        .select('*')
        .in('id', placeIds);

      if (placesError) {
        throw placesError;
      }

      // Group matched reviews by place
      const placesWithMatches = (places || []).map((place) => {
        const placeMatches = matchedReviews.filter((r: { place_id: string }) => r.place_id === place.id);
        const topSimilarity = Math.max(...placeMatches.map((r: { similarity: number }) => r.similarity || 0));
        return {
          ...place,
          relevanceScore: topSimilarity,
          matchedReviews: placeMatches,
        };
      });

      // Sort by similarity score descending
      placesWithMatches.sort((a, b) => b.relevanceScore - a.relevanceScore);

      await logSearchQuery({ query, searchType: 'semantic', resultsCount: placesWithMatches.length });

      return NextResponse.json({
        results: placesWithMatches,
        mode: 'semantic',
      });
    } catch (err: unknown) {
      console.error('[Search] Semantic search failed, falling back to keyword:', err);
      // Fallback seamlessly to keyword search
      return runKeywordSearch(supabase, query);
    }
  } else {
    // Keyword mode
    return runKeywordSearch(supabase, query);
  }
}

async function runKeywordSearch(supabase: ReturnType<typeof getServiceRoleClient>, query: string) {
  const sanitized = query.replace(/[%,_]/g, '');
  const pattern = `%${sanitized}%`;

  const { data: places, error } = await supabase
    .from('places')
    .select('*')
    .or(`name.ilike.${pattern},description.ilike.${pattern},address.ilike.${pattern},summary.ilike.${pattern}`)
    .limit(20);

  if (error) {
    console.error('[Search] Keyword error:', error.message);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }

  const results = places || [];
  await logSearchQuery({ query, searchType: 'keyword', resultsCount: results.length });

  return NextResponse.json({
    results,
    mode: 'keyword',
  });
}
