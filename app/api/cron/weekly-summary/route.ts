import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { generatePlaceProfile, FLASH_MODEL } from '@/lib/gemini';

export async function GET(request: NextRequest) {
  // 1. Verify Vercel Cron Secret, Bearer Token, or Admin Access Token
  const authHeader = request.headers.get('authorization');
  const cronSecretHeader = request.headers.get('x-cron-secret');
  const adminTokenHeader = request.headers.get('x-admin-token');
  const expectedSecret = process.env.CRON_SECRET || 'cron-secret-123';
  const expectedAdminToken = process.env.ADMIN_ACCESS_TOKEN || 'admin123';

  const token = authHeader?.replace('Bearer ', '') || cronSecretHeader || adminTokenHeader;
  const isAuthorized = !!token && (token === expectedSecret || token === expectedAdminToken);

  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized trigger' }, { status: 401 });
  }

  const supabase = getServiceRoleClient();
  const summaryReport: Array<{
    placeId: string;
    placeName: string;
    version: number;
    categories: string[];
    tags: string[];
    status: string;
  }> = [];

  try {
    // 2. Fetch all places with their current description and tags
    const { data: places, error: placesErr } = await supabase
      .from('places')
      .select('id, name, description, tags, average_cost_per_person');
    if (placesErr) throw placesErr;

    for (const place of places || []) {
      // Fetch approved reviews for this place
      const { data: reviews, error: revErr } = await supabase
        .from('reviews')
        .select('content, must_try_dishes, price_paid, rating')
        .eq('place_id', place.id)
        .eq('status', 'approved')
        .limit(20);

      // Skip spots that have neither reviews nor a description/tags to analyze
      if ((!reviews || reviews.length === 0) && !place.description && (!place.tags || place.tags.length === 0)) {
        continue;
      }

      // Find current latest version
      const { data: latestProfile } = await supabase
        .from('place_profiles')
        .select('version')
        .eq('place_id', place.id)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextVersion = (latestProfile?.version || 0) + 1;

      // 3. Generate structured AI profile & fix spelling/taxonomy using gemini-2.0-flash
      const profileData = await generatePlaceProfile(
        place.name,
        reviews || [],
        { description: place.description, tags: place.tags }
      );

      // Merge canonical categories and normalized tags into clean, unique tags (removes typos & aligns UI filters)
      const cleanMergedTags = Array.from(
        new Set([...profileData.canonical_categories, ...profileData.normalized_tags])
      );

      // 4. Strictly write to allowlisted columns on place_profiles
      const { data: newProfile, error: profileInsertErr } = await supabase
        .from('place_profiles')
        .insert({
          place_id: place.id,
          version: nextVersion,
          summary: profileData.summary,
          must_try_dishes: profileData.must_try_dishes,
          price_range_min: profileData.price_range_min,
          price_range_max: profileData.price_range_max,
          vibe_tags: profileData.vibe_tags,
          review_count_sampled: reviews?.length || 0,
          model_used: FLASH_MODEL,
        })
        .select('id')
        .single();

      if (profileInsertErr) {
        console.error(`[Cron] Profile insert failed for ${place.name}:`, profileInsertErr.message);
        continue;
      }

      // Update places with the refreshed rolling summary, normalized tags, and average cost
      const estimatedCost = place.average_cost_per_person || Math.round((profileData.price_range_min + profileData.price_range_max) / 2);

      await supabase
        .from('places')
        .update({
          summary: profileData.summary,
          tags: cleanMergedTags,
          average_cost_per_person: estimatedCost,
          latest_profile_id: newProfile.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', place.id);

      summaryReport.push({
        placeId: place.id,
        placeName: place.name,
        version: nextVersion,
        categories: profileData.canonical_categories,
        tags: cleanMergedTags,
        status: 'categorized_and_summarized',
      });
    }

    // 5. Enforce retention policy on search_logs (cleanup older than 90 days)
    const { data: cleanedCount, error: cleanupErr } = await supabase.rpc('cleanup_old_search_logs', {
      retention_days: 90,
    });

    if (cleanupErr) {
      console.warn('[Cron] Retention policy cleanup warning:', cleanupErr.message);
    }

    return NextResponse.json({
      success: true,
      summarizedCount: summaryReport.length,
      searchLogsPruned: cleanedCount || 0,
      report: summaryReport,
    });
  } catch (err: unknown) {
    console.error('[Cron] Weekly summary job error:', err);
    return NextResponse.json({ error: (err as Error).message || 'Cron job failed' }, { status: 500 });
  }
}
