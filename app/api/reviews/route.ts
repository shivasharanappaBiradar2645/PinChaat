import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { checkSubmissionRateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : '127.0.0.1';

  // 1. Rate limit check (Postgres-backed)
  const allowed = await checkSubmissionRateLimit(ip);
  if (!allowed) {
    return NextResponse.json(
      { error: 'You are submitting too quickly. Please wait a few minutes before submitting another review.' },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { place_id, author_name, rating, content, must_try_dishes, price_paid } = body;

    if (!place_id || !content || !rating) {
      return NextResponse.json(
        { error: 'Place, rating, and review content are required.' },
        { status: 400 }
      );
    }

    const numRating = Number(rating);
    if (isNaN(numRating) || numRating < 1 || numRating > 5) {
      return NextResponse.json({ error: 'Rating must be between 1 and 5.' }, { status: 400 });
    }

    const dishesArray = Array.isArray(must_try_dishes)
      ? must_try_dishes
      : typeof must_try_dishes === 'string'
      ? must_try_dishes.split(',').map((d: string) => d.trim()).filter(Boolean)
      : [];

    const supabase = getServiceRoleClient();

    const { data, error } = await supabase
      .from('reviews')
      .insert({
        place_id,
        author_name: (author_name || 'Anonymous Foodie').trim().slice(0, 50),
        rating: numRating,
        content: content.trim().slice(0, 2000),
        must_try_dishes: dishesArray.slice(0, 10),
        price_paid: price_paid ? Number(price_paid) : null,
        status: 'pending', // Requires admin approval before vector embedding
      })
      .select('id, status, created_at')
      .single();

    if (error) {
      console.error('[Reviews] Insert error:', error.message);
      return NextResponse.json({ error: 'Failed to submit review' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Review submitted anonymously! It will appear once approved by admin.',
      review: data,
    });
  } catch (err: unknown) {
    console.error('[Reviews] Submission exception:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
