import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

export function proxy(request: NextRequest) {
  const password = process.env.STUDIO_ACCESS_PASSWORD;
  if (!password) return NextResponse.next();

  const expected = Buffer.from('Basic ' + Buffer.from('studio:' + password).toString('base64'));
  const supplied = Buffer.from(request.headers.get('authorization') ?? '');
  if (supplied.length === expected.length && timingSafeEqual(supplied, expected)) {
    return NextResponse.next();
  }
  return new Response('Sign in to Khmer Dub Studio.', {
    status: 401,
    headers: {'WWW-Authenticate': 'Basic realm="Khmer Dub Studio"', 'Cache-Control': 'no-store'},
  });
}

export const config = {matcher: ['/:path*']};
