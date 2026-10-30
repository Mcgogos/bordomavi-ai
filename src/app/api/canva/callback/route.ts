import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { CanvaService } from '@/lib/canva/canva-service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      `${req.nextUrl.protocol}//${req.nextUrl.host}`;
    const redirectBase = origin.replace(/\/$/, '');

    if (error || !code) {
      return NextResponse.redirect(
        `${redirectBase}/settings?canva_error=${encodeURIComponent(error || 'missing_code')}`
      );
    }

    const creds = await CanvaService.getCredentials();
    if (!creds.clientId || !creds.clientSecret) {
      return NextResponse.redirect(
        `${redirectBase}/settings?canva_error=missing_client_credentials`
      );
    }

    const pkceSetting = await prisma.setting.findUnique({
      where: { key: 'CANVA_PKCE_VERIFIER' },
    });
    if (!pkceSetting?.value) {
      return NextResponse.redirect(`${redirectBase}/settings?canva_error=missing_pkce_verifier`);
    }

    const { codeVerifier } = JSON.parse(pkceSetting.value);
    const redirectUri = `${redirectBase}/api/canva/callback`;

    const basicAuth = Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString('base64');
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code_verifier: codeVerifier,
      code,
      redirect_uri: redirectUri,
    });

    const tokenRes = await fetch('https://api.canva.com/rest/v1/oauth/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      return NextResponse.redirect(
        `${redirectBase}/settings?canva_error=${encodeURIComponent(
          tokenData.error_description || tokenData.error || 'token_exchange_failed'
        )}`
      );
    }

    await CanvaService.saveCredentials({
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
    });

    return NextResponse.redirect(`${redirectBase}/settings?canva_connected=1`);
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
