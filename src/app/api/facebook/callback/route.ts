import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  
  if (!code) {
    return NextResponse.json({ error: "Facebook authorization failed. No code returned." }, { status: 400 });
  }

  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;

  if (!appId || !appSecret) {
    return NextResponse.json({ error: "FACEBOOK_APP_ID or FACEBOOK_APP_SECRET missing." }, { status: 500 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.URL || 'https://bordomavi-ai-editor.netlify.app';
  const redirectUri = `${appUrl}/api/facebook/callback`;

  try {
    // 1. Exchange code for short-lived access token
    const tokenRes = await fetch(`https://graph.facebook.com/v18.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`);
    const tokenData = await tokenRes.json();
    if (tokenData.error) throw new Error(tokenData.error.message);

    const shortToken = tokenData.access_token;

    // 2. Exchange short-lived token for long-lived token
    const longTokenRes = await fetch(`https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortToken}`);
    const longTokenData = await longTokenRes.json();
    if (longTokenData.error) throw new Error(longTokenData.error.message);

    const longLivedUserToken = longTokenData.access_token;

    // 3. Fetch User's Pages to get the Page Access Token
    const pagesRes = await fetch(`https://graph.facebook.com/v18.0/me/accounts?access_token=${longLivedUserToken}`);
    const pagesData = await pagesRes.json();
    if (pagesData.error) throw new Error(pagesData.error.message);

    if (!pagesData.data || pagesData.data.length === 0) {
      return NextResponse.json({ error: "No Facebook Pages found for this user." }, { status: 400 });
    }

    // Usually select the first page, or filter by a predefined page name
    const page = pagesData.data[0];
    const pageAccessToken = page.access_token;
    const pageId = page.id;

    // 4. Save Page Token and Page ID securely into DB
    await prisma.setting.upsert({
      where: { key: 'FACEBOOK_PAGE_TOKEN' },
      update: { value: pageAccessToken },
      create: { key: 'FACEBOOK_PAGE_TOKEN', value: pageAccessToken }
    });

    await prisma.setting.upsert({
      where: { key: 'FACEBOOK_PAGE_ID' },
      update: { value: pageId },
      create: { key: 'FACEBOOK_PAGE_ID', value: pageId }
    });

    // 5. Redirect back to Settings Page
    return NextResponse.redirect(`${appUrl}/settings`);
  } catch (error: any) {
    console.error("Facebook OAuth Callback Error:", error);
    return NextResponse.json({ error: "Failed to exchange Facebook token.", details: error.message }, { status: 500 });
  }
}