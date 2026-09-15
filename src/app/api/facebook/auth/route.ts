import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const appId = process.env.FACEBOOK_APP_ID;
  if (!appId) {
    return NextResponse.json({ error: "FACEBOOK_APP_ID is not configured in environment variables. Lütfen Vercel/Netlify üzerinden FACEBOOK_APP_ID ve FACEBOOK_APP_SECRET değerlerini girin." }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.URL || 'https://bordomavi-ai-editor.netlify.app';
  const redirectUri = `${appUrl}/api/facebook/callback`;
  const scopes = "pages_show_list,pages_manage_posts,pages_read_engagement";

  const fbAuthUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&auth_type=rerequest`;
  
  return NextResponse.redirect(fbAuthUrl);
}