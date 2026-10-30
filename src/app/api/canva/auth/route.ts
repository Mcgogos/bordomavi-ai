import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/db';
import { CanvaService } from '@/lib/canva/canva-service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const creds = await CanvaService.getCredentials();
    if (!creds.clientId) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Canva Client ID henüz tanımlanmamış. Lütfen Canva Developer Portal üzerinden aldığınız Client ID (OC-...) ve Client Secret bilgisini kaydedin.',
        },
        { status: 400 }
      );
    }

    const codeVerifier = crypto.randomBytes(64).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
    const state = crypto.randomBytes(16).toString('hex');

    await prisma.setting.upsert({
      where: { key: 'CANVA_PKCE_VERIFIER' },
      update: { value: JSON.stringify({ codeVerifier, state, createdAt: Date.now() }) },
      create: { key: 'CANVA_PKCE_VERIFIER', value: JSON.stringify({ codeVerifier, state, createdAt: Date.now() }) },
    });

    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      `${req.nextUrl.protocol}//${req.nextUrl.host}`;
    const redirectUri = `${origin.replace(/\/$/, '')}/api/canva/callback`;

    const scopes = [
      'design:content:read',
      'design:content:write',
      'design:meta:read',
      'asset:read',
      'asset:write',
      'profile:read',
    ].join(' ');

    const authUrl = new URL('https://www.canva.com/api/oauth/authorize');
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', creds.clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('state', state);

    return NextResponse.redirect(authUrl.toString());
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
