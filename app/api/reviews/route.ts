import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { checkSubmissionRateLimit } from '@/lib/rate-limit';
import { getEmbedding } from '@/lib/gemini';

export async function POST(request: NextRequest) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : '127.0.0.1';

  // Check if request is authenticated as admin
  const adminToken = request.headers.get('x-admin-token') || request.cookies.get('admin_token')?.value;
  const expectedAdminToken = process.env.ADMIN_ACCESS_TOKEN || 'admin123';
  const isAdmin = !!adminToken && adminToken === expectedAdminToken;

  // 1. Rate limit check (Bypassed completely with NO LIMIT for admin)
  if (!isAdmin) {
    const allowed = await checkSubmissionRateLimit(ip);
    if (!allowed) {
      return NextResponse.json(
        { error: 'You are submitting too quickly. Please wait a few minutes before submitting another review.' },
        { status: 429 }
      );
    }
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

    let initialStatus = 'pending';
    let embedding: number[] | null = null;
    let embeddingModel: string | null = null;
    let approvedAt: string | null = null;

    // If Admin: Auto-approve and immediately generate Gemini vector embedding
    if (isAdmin) {
      initialStatus = 'approved';
      approvedAt = new Date().toISOString();

      try {
        const { data: place } = await supabase
          .from('places')
          .select('name')
          .eq('id', place_id)
          .single();

        const placeName = place?.name || 'Local Spot';
        const dishesText = dishesArray.join(', ');
        const embedText = `Place: ${placeName}. Must-try items: ${dishesText || 'N/A'}. Price: ${price_paid ? '₹' + price_paid : 'N/A'}. Patrons Review: ${content}`;

        const embedResult = await getEmbedding(embedText, 'RETRIEVAL_DOCUMENT');
        embedding = embedResult.embedding;
        embeddingModel = embedResult.model;
      } catch (embedErr) {
        console.warn('[Reviews] Admin auto-embed warning:', embedErr);
      }
    }

    const { data, error } = await supabase
      .from('reviews')
      .insert({
        place_id,
        author_name: (author_name || (isAdmin ? 'Admin' : 'Anonymous Foodie')).trim().slice(0, 50),
        rating: numRating,
        content: content.trim().slice(0, 2000),
        must_try_dishes: dishesArray.slice(0, 10),
        price_paid: price_paid ? Number(price_paid) : null,
        status: initialStatus,
        embedding: embedding,
        embedding_model: embeddingModel,
        approved_at: approvedAt,
      })
      .select('id, status, created_at')
      .single();

    if (error) {
      console.error('[Reviews] Insert error:', error.message);
      return NextResponse.json({ error: 'Failed to submit review' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: isAdmin
        ? 'Admin review published and vector-embedded immediately!'
        : 'Review submitted anonymously! It will appear once approved by admin.',
      review: data,
      isAdmin,
    });
  } catch (err: unknown) {
    console.error('[Reviews] Submission exception:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
