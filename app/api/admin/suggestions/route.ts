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
  const { data: suggestions, error } = await supabase
    .from('place_suggestions')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ suggestions });
}

export async function POST(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { suggestion_id, action } = await request.json();

    if (!suggestion_id || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    const supabase = getServiceRoleClient();

    if (action === 'reject') {
      const { error } = await supabase
        .from('place_suggestions')
        .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
        .eq('id', suggestion_id);

      if (error) throw error;
      return NextResponse.json({ success: true, status: 'rejected' });
    }

    // Approve: fetch suggestion details and create new place record
    const { data: suggestion, error: fetchErr } = await supabase
      .from('place_suggestions')
      .select('*')
      .eq('id', suggestion_id)
      .single();

    if (fetchErr || !suggestion) {
      return NextResponse.json({ error: 'Suggestion not found' }, { status: 404 });
    }

    const { data: newPlace, error: insertErr } = await supabase
      .from('places')
      .insert({
        name: suggestion.name,
        address: suggestion.address,
        latitude: suggestion.latitude,
        longitude: suggestion.longitude,
        google_maps_url: suggestion.google_maps_url,
        price_level: suggestion.price_level,
        tags: suggestion.tags || [],
        description: suggestion.reason || 'Community recommended foodie spot.',
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    // Mark suggestion approved
    await supabase
      .from('place_suggestions')
      .update({ status: 'approved', reviewed_at: new Date().toISOString() })
      .eq('id', suggestion_id);

    return NextResponse.json({ success: true, place: newPlace });
  } catch (err: unknown) {
    console.error('[Admin Suggestions] Action exception:', err);
    return NextResponse.json({ error: (err as Error).message || 'Failed' }, { status: 500 });
  }
}
