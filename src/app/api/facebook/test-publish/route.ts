import { NextResponse } from 'next/server';
import { FacebookService } from '@/services/facebook.service';
import { verifyApiAuthorization } from '@/lib/api-auth';

export async function POST(request: Request) {
  const authCheck = await verifyApiAuthorization(request);
  if (!authCheck.authorized) {
    return authCheck.unauthorizedResponse!;
  }

  try {
    const isMock = process.env.FACEBOOK_MOCK_MODE === 'true';

    console.log(`[Facebook Test Publish] Starting test publish. Mock mode: ${isMock ? 'AKTIF' : 'KAPALI'}`);

    const testMessage = `🔵🔴 BORDO MAVİ AI EDİTÖR TEST GÖNDERİSİ

Bu gönderi Meta Graph API bağlantısını test etmek amacıyla yayınlanmıştır.

#BordoMavi #Test`;

    // Send to FacebookService which already handles Mock vs Real logic based on FACEBOOK_MOCK_MODE
    const result = await FacebookService.publishPost(testMessage);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: "Test gönderisi işlemi tamamlandı.",
        postId: result.postId
      }, { status: 200 });
    } else {
      return NextResponse.json({
        success: false,
        message: "Gönderi yayınlanamadı."
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error("[Facebook Test Publish] Hata oluştu:", error.message);
    return NextResponse.json({
      success: false,
      message: "API isteği başarısız oldu.",
      error: error.message
    }, { status: 500 });
  }
}
