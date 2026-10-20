import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';

function verifyAdmin(request: NextRequest): boolean {
  const token = request.headers.get('x-admin-token') || request.cookies.get('admin_token')?.value;
  const expected = process.env.ADMIN_ACCESS_TOKEN || 'admin123';
  return !!token && token === expected;
}

export async function GET(request: NextRequest) {
  const supabase = getServiceRoleClient();
  const { data: places, error } = await supabase
    .from('places')
    .select('*, reviews(count)')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ places });
}

export async function POST(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      name,
      description,
      address,
      latitude,
      longitude,
      google_maps_url,
      price_level,
      average_cost_per_person,
      tags,
      cover_image_url,
    } = body;

    if (!name || latitude === undefined || longitude === undefined) {
      return NextResponse.json({ error: 'Name, latitude, and longitude are required' }, { status: 400 });
    }

    const tagsArray = Array.isArray(tags)
      ? tags
      : typeof tags === 'string'
      ? tags.split(',').map((t: string) => t.trim()).filter(Boolean)
      : [];

    const supabase = getServiceRoleClient();
    const { data: place, error } = await supabase
      .from('places')
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        address: address?.trim() || null,
        latitude: Number(latitude),
        longitude: Number(longitude),
        google_maps_url: google_maps_url?.trim() || null,
        price_level: price_level || 'moderate',
        average_cost_per_person: average_cost_per_person ? Number(average_cost_per_person) : null,
        tags: tagsArray,
        cover_image_url: cover_image_url?.trim() || null,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, place });
  } catch (err: unknown) {
    console.error('[Admin Places] Insert error:', err);
    return NextResponse.json({ error: (err as Error).message || 'Failed to create place' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing place ID' }, { status: 400 });
  }

  const supabase = getServiceRoleClient();
  const { error } = await supabase.from('places').delete().eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
