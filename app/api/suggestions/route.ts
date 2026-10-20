import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { checkSubmissionRateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : '127.0.0.1';

  // 1. Check submission rate limit
  const allowed = await checkSubmissionRateLimit(ip);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Submission limit reached. Please wait a few minutes before submitting another place.' },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { name, address, latitude, longitude, google_maps_url, price_level, tags, reason } = body;

    let finalLat = latitude !== undefined && latitude !== null ? Number(latitude) : null;
    let finalLng = longitude !== undefined && longitude !== null ? Number(longitude) : null;

    // Auto-resolve coordinates from Google Maps link if not provided or if link is present
    if (google_maps_url && (finalLat === null || finalLng === null || (finalLat === 0 && finalLng === 0))) {
      try {
        const { resolveGoogleMapsUrl } = await import('@/lib/maps-extractor');
        const resolved = await resolveGoogleMapsUrl(google_maps_url.trim());
        if (resolved) {
          finalLat = resolved.lat;
          finalLng = resolved.lng;
        }
      } catch (err: unknown) {
        console.warn('[Suggestions] Auto-resolve URL failed:', err);
      }
    }

    if (!name) {
      return NextResponse.json({ error: 'Spot name is required.' }, { status: 400 });
    }

    // Default to central Delhi coordinates if no pin or maps resolution was possible
    if (finalLat === null || finalLng === null) {
      finalLat = 28.6139;
      finalLng = 77.2090;
    }

    const tagsArray = Array.isArray(tags)
      ? tags
      : typeof tags === 'string'
      ? tags.split(',').map((t: string) => t.trim()).filter(Boolean)
      : [];

    const supabase = getServiceRoleClient();

    const { data, error } = await supabase
      .from('place_suggestions')
      .insert({
        name: name.trim().slice(0, 100),
        address: (address || '').trim().slice(0, 250),
        latitude: finalLat,
        longitude: finalLng,
        google_maps_url: (google_maps_url || '').trim().slice(0, 500) || null,
        price_level: ['budget', 'moderate', 'expensive'].includes(price_level) ? price_level : 'moderate',
        tags: tagsArray.slice(0, 10),
        reason: (reason || '').trim().slice(0, 500),
        status: 'pending',
      })
      .select('id, status, created_at')
      .single();

    if (error) {
      console.error('[Suggestions] Insert error:', error.message);
      return NextResponse.json({ error: 'Failed to submit place suggestion' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Spot suggested! The admin will review and pin it to the map soon.',
      suggestion: data,
    });
  } catch (err: unknown) {
    console.error('[Suggestions] Submission exception:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
