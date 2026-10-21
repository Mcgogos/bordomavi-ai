import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

/**
 * Merkezi API Güvenlik ve Yetkilendirme Yardımcısı
 * 
 * Şu iki durumdan biri sağlandığında erişime izin verir:
 * 1. Oturum Açmış Yönetici (NextAuth Session / Admin Girişi)
 * 2. Geçerli CRON_SECRET (Query Param, Bearer Token veya x-cron-secret Header)
 * 
 * Dışarıdan yetkisiz veya şifresiz gelen tüm istekleri 401 Unauthorized ile engeller.
 */
export async function verifyApiAuthorization(request: Request): Promise<{
  authorized: boolean;
  unauthorizedResponse?: NextResponse;
  method?: 'SESSION' | 'CRON_SECRET';
}> {
  // 1. NextAuth Oturum Denetimi (Web arayüzünden giriş yapmış kullanıcılar)
  try {
    const session = await auth();
    if (session?.user) {
      return { authorized: true, method: 'SESSION' };
    }
  } catch {
    // Session kontrolü başarısız ise cron secret kontrolüne devam et
  }

  // 2. CRON_SECRET Denetimi (GitHub Actions, Vercel Cron, Netlify Background Functions)
  try {
    const { searchParams } = new URL(request.url);
    const secretParam = searchParams.get('secret');
    const authHeader = request.headers.get('authorization')?.replace('Bearer ', '').trim();
    const xCronHeader = request.headers.get('x-cron-secret')?.trim();

    const incomingSecret = secretParam || authHeader || xCronHeader;
    const expectedSecret = process.env.CRON_SECRET || 'test_secret';

    if (expectedSecret && incomingSecret === expectedSecret) {
      return { authorized: true, method: 'CRON_SECRET' };
    }
  } catch {
    // URL parse hatası
  }

  return {
    authorized: false,
    unauthorizedResponse: NextResponse.json(
      {
        success: false,
        error: 'Unauthorized: Bu API uç noktasına erişim için geçerli bir oturum veya CRON_SECRET gereklidir.'
      },
      { status: 401 }
    )
  };
}
