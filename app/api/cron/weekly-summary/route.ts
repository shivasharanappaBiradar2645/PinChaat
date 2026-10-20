import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { generatePlaceProfile, FLASH_MODEL } from '@/lib/gemini';

export async function GET(request: NextRequest) {
  // 1. Verify Vercel Cron Secret or Bearer Token
  const authHeader = request.headers.get('authorization');
  const cronSecretHeader = request.headers.get('x-cron-secret');
  const expectedSecret = process.env.CRON_SECRET || 'cron-secret-123';

  const token = authHeader?.replace('Bearer ', '') || cronSecretHeader;
  if (!token || token !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized cron trigger' }, { status: 401 });
  }

  const supabase = getServiceRoleClient();
  const summaryReport: Array<{ placeId: string; placeName: string; version: number; status: string }> = [];

  try {
    // 2. Fetch all places
    const { data: places, error: placesErr } = await supabase.from('places').select('id, name');
    if (placesErr) throw placesErr;

    for (const place of places || []) {
      // Fetch approved reviews for this place
      const { data: reviews, error: revErr } = await supabase
        .from('reviews')
        .select('content, must_try_dishes, price_paid, rating')
        .eq('place_id', place.id)
        .eq('status', 'approved')
        .limit(20);

      if (revErr || !reviews || reviews.length === 0) {
        continue; // Skip spots with no approved reviews yet
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

      // 3. Generate structured AI profile using gemini-2.0-flash with untrusted data isolation
      const profileData = await generatePlaceProfile(place.name, reviews);

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
          review_count_sampled: reviews.length,
          model_used: FLASH_MODEL,
        })
        .select('id')
        .single();

      if (profileInsertErr) {
        console.error(`[Cron] Profile insert failed for ${place.name}:`, profileInsertErr.message);
        continue;
      }

      // Update places with the refreshed rolling summary & profile pointer
      await supabase
        .from('places')
        .update({
          summary: profileData.summary,
          latest_profile_id: newProfile.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', place.id);

      summaryReport.push({
        placeId: place.id,
        placeName: place.name,
        version: nextVersion,
        status: 'updated',
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
