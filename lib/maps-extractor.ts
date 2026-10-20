/**
 * Extracts latitude and longitude from various Google Maps URL formats.
 */
export function extractCoordinatesFromUrl(url: string): { lat: number; lng: number } | null {
  if (!url || typeof url !== 'string') return null;

  // 1. Pattern: /@28.6139,77.2090,17z
  const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
  }

  // 2. Pattern: !3d28.6139!4d77.2090
  const protoMatch = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (protoMatch) {
    const lat = parseFloat(protoMatch[1]);
    const lng = parseFloat(protoMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
  }

  // 3. Pattern: ?q=28.6139,77.2090 or &ll=28.6139,77.2090
  const queryMatch = url.match(/[?&](?:q|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (queryMatch) {
    const lat = parseFloat(queryMatch[1]);
    const lng = parseFloat(queryMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
  }

  return null;
}

/**
 * Resolves shortened Google Maps links (e.g. maps.app.goo.gl, goo.gl) by following redirects.
 */
export async function resolveGoogleMapsUrl(url: string): Promise<{
  lat: number;
  lng: number;
  resolvedUrl: string;
} | null> {
  const directCoords = extractCoordinatesFromUrl(url);
  if (directCoords) {
    return { ...directCoords, resolvedUrl: url };
  }

  // If it's a shortened URL, follow redirects
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    const finalUrl = res.url || url;
    const finalCoords = extractCoordinatesFromUrl(finalUrl);
    if (finalCoords) {
      return { ...finalCoords, resolvedUrl: finalUrl };
    }

    // Attempt to extract from page HTML content if Google Maps embeds coordinates in meta or scripts
    const html = await res.text();
    const metaCoords = html.match(/itemprop="latitude" content="(-?\d+\.\d+)"[\s\S]*?itemprop="longitude" content="(-?\d+\.\d+)"/);
    if (metaCoords) {
      return {
        lat: parseFloat(metaCoords[1]),
        lng: parseFloat(metaCoords[2]),
        resolvedUrl: finalUrl,
      };
    }

    // Try finding /@lat,lng in page text
    const textMatch = html.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (textMatch) {
      return {
        lat: parseFloat(textMatch[1]),
        lng: parseFloat(textMatch[2]),
        resolvedUrl: finalUrl,
      };
    }

    return null;
  } catch (err: unknown) {
    console.error('[MapsExtractor] Failed to resolve URL:', err);
    return null;
  }
}
