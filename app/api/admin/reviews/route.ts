import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { getEmbedding } from '@/lib/gemini';

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
  const { data: reviews, error } = await supabase
    .from('reviews')
    .select('*, places(id, name, address)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Admin Reviews] Fetch error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ reviews });
}

export async function PATCH(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { review_id, action } = await request.json();

    if (!review_id || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    const supabase = getServiceRoleClient();

    if (action === 'reject') {
      const { error } = await supabase
        .from('reviews')
        .update({ status: 'rejected' })
        .eq('id', review_id);

      if (error) throw error;
      return NextResponse.json({ success: true, status: 'rejected' });
    }

    // Approval flow: Fetch review + place name, generate 768-dim embedding, store vector
    const { data: review, error: fetchErr } = await supabase
      .from('reviews')
      .select('*, places(name, tags)')
      .eq('id', review_id)
      .single();

    if (fetchErr || !review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }

    const placeName = review.places?.name || 'Local Spot';
    const dishesText = (review.must_try_dishes || []).join(', ');
    const embedText = `Place: ${placeName}. Must-try items: ${dishesText || 'N/A'}. Price: ${review.price_paid ? '₹' + review.price_paid : 'N/A'}. Patrons Review: ${review.content}`;

    // Generate vector embedding with taskType: 'RETRIEVAL_DOCUMENT' & 768 dimensions
    const { embedding, model } = await getEmbedding(embedText, 'RETRIEVAL_DOCUMENT');

    const { error: updateErr } = await supabase
      .from('reviews')
      .update({
        status: 'approved',
        embedding,
        embedding_model: model,
        approved_at: new Date().toISOString(),
      })
      .eq('id', review_id);

    if (updateErr) throw updateErr;

    return NextResponse.json({
      success: true,
      status: 'approved',
      embedding_model: model,
    });
  } catch (err: unknown) {
    console.error('[Admin Reviews] Action exception:', err);
    return NextResponse.json({ error: (err as Error).message || 'Failed to moderate review' }, { status: 500 });
  }
}
