import { NextRequest, NextResponse } from 'next/server';
import { resolveGoogleMapsUrl, extractCoordinatesFromUrl } from '@/lib/maps-extractor';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'Valid URL is required' }, { status: 400 });
    }

    const trimmedUrl = url.trim();

    // Try fast sync extraction first
    const fastCoords = extractCoordinatesFromUrl(trimmedUrl);
    if (fastCoords) {
      return NextResponse.json({
        success: true,
        latitude: fastCoords.lat,
        longitude: fastCoords.lng,
        resolvedUrl: trimmedUrl,
      });
    }

    // Try asynchronous redirect resolution
    const resolved = await resolveGoogleMapsUrl(trimmedUrl);
    if (!resolved) {
      return NextResponse.json(
        { error: 'Could not automatically extract coordinates from this link. You can still set the pin manually on the map.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      latitude: resolved.lat,
      longitude: resolved.lng,
      resolvedUrl: resolved.resolvedUrl,
    });
  } catch (err: unknown) {
    console.error('[ResolveMaps API] Error:', err);
    return NextResponse.json({ error: 'Failed to resolve map URL' }, { status: 500 });
  }
}
