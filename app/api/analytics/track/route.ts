import { NextRequest, NextResponse } from 'next/server';
import { trackPageView } from '@/lib/analytics';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const forwardedFor = request.headers.get('x-forwarded-for');
    const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : '127.0.0.1';
    const userAgent = request.headers.get('user-agent');

    await trackPageView({
      ip,
      path: body.path || '/',
      placeId: body.placeId,
      userAgent,
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
