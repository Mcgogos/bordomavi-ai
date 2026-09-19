import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { CorporateVisualEngine } from '@/services/visual/CorporateVisualEngine';
import { TemplateSelector, VisualTemplateType } from '@/services/visual/TemplateSelector';
import { BORDOMAVI_BRAND_LOGO_DATA_URI } from '@/lib/canva/brand-logo-data';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawTitle = searchParams.get('title') || "Trabzonspor'da Flaş Gelişme!";
    const title = rawTitle.replace(/\*\*/g, '').replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, '$1$2$3').trim();
    const rawSummary = searchParams.get('summary') || '';
    const summary = rawSummary.replace(/\*\*/g, '').replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, '$1$2$3').trim();
    const externalImageUrl = searchParams.get('imageUrl') || null;
    
    // 1. TemplateSelector (Haber türünü analiz edip template seçer)
    const template = TemplateSelector.selectTemplate(title, summary);
    
    // 2. Colors
    const colors = CorporateVisualEngine.getColors();
    const requestedTemplate = searchParams.get('template')?.toUpperCase();
    const minute = searchParams.get('minute');
    const score = searchParams.get('score');
    const player = searchParams.get('player');

    const canvasWidth = 1200;
    const canvasHeight = 630;
    
    // 3. Kullanıcının Orijinal BordoMavi Logosu (Bellek içi Base64 - Sıfır fs / Sıfır Vercel hatası)
    const logoDataUrl = BORDOMAVI_BRAND_LOGO_DATA_URI;

    // 4. Harici Haber Görselini Güvenli İndirme (WebP / 403 / Timeout Koruması)
    let safeExternalImageDataUrl: string | null = null;
    if (externalImageUrl) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);
        const imgRes = await fetch(externalImageUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'image/jpeg,image/png,image/*;q=0.8'
          },
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (imgRes.ok) {
          const contentType = (imgRes.headers.get('content-type') || '').toLowerCase();
          // Satori data-uri olarak JPEG ve PNG'yi kusursuz işler
          if (contentType.includes('jpeg') || contentType.includes('jpg') || contentType.includes('png')) {
            const arrayBuffer = await imgRes.arrayBuffer();
            const mime = contentType.includes('png') ? 'image/png' : 'image/jpeg';
            safeExternalImageDataUrl = `data:${mime};base64,${Buffer.from(arrayBuffer).toString('base64')}`;
          }
        }
      } catch (e) {
        console.warn("[OG Route] Harici görsel indirilemedi, kurumsal dinamik zemin kullanılıyor:", e);
      }
    }

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            backgroundColor: '#0a0f1d', 
            color: colors.beyaz,
            position: 'relative',
            overflow: 'hidden',
            fontFamily: 'sans-serif'
          }}
        >
          {/* EXTERNAL IMAGE BACKGROUND (If Available & Verified Safe) */}
          {safeExternalImageDataUrl ? (
            <>
              <img 
                src={safeExternalImageDataUrl} 
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }}
              />
              {/* BORDO-MAVI COLOR FILTER OVER EXTERNAL IMAGE */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                background: 'linear-gradient(135deg, rgba(123,15,29,0.85) 0%, rgba(46,139,201,0.85) 100%)',
              }} />
            </>
          ) : (
            <>
              {/* DEFAULT DIKKAT CEKICI ARKA PLAN (Dinamik ve Sert Renk Gecisleri) */}
              <div style={{
                position: 'absolute',
                top: '-30%',
                right: '-10%',
                width: '900px',
                height: '900px',
                background: 'radial-gradient(circle, rgba(123,15,28,0.7) 0%, rgba(10,15,29,0) 70%)',
              }} />
              
              <div style={{
                position: 'absolute',
                bottom: '-40%',
                left: '-10%',
                width: '1000px',
                height: '1000px',
                background: 'radial-gradient(circle, rgba(46,139,201,0.5) 0%, rgba(10,15,29,0) 60%)',
              }} />
            </>
          )}

          {/* Aksiyon Katmani (Cizgiler) */}
          <div style={{
            position: 'absolute',
            top: '0',
            right: '15%',
            width: '2px',
            height: '100%',
            backgroundColor: 'rgba(255,255,255,0.05)',
            transform: 'rotate(15deg)'
          }} />
          <div style={{
            position: 'absolute',
            top: '0',
            right: '25%',
            width: '2px',
            height: '100%',
            backgroundColor: 'rgba(255,255,255,0.03)',
            transform: 'rotate(15deg)'
          }} />

          {/* OVERLAY ENGINE: Sol taraf icin sert karartma (Metin okunabilirligi) */}
          <div style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: '75%', 
            background: 'linear-gradient(to right, rgba(10,15,29, 0.95) 0%, rgba(10,15,29, 0.6) 60%, transparent 100%)',
            zIndex: 1
          }} />

          {/* MAIN CONTENT / TYPOGRAPHY ENGINE */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            paddingLeft: '70px',
            paddingRight: '35%',
            paddingTop: '50px',
            paddingBottom: '50px',
            width: '100%',
            height: '100%',
            zIndex: 10
          }}>
            {/* Canlı Skor & Dakika Bilgisi (Sadece maç anında parametre iletilmişse gösterilir) */}
            {(score || minute) && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                marginBottom: '25px',
                alignSelf: 'flex-start'
              }}>
                {score && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: 'rgba(255,255,255,0.15)',
                    border: '2px solid rgba(255,255,255,0.4)',
                    padding: '10px 22px',
                    borderRadius: '8px',
                    fontWeight: '900',
                    fontSize: '22px',
                    letterSpacing: '1px',
                    color: '#FFFFFF'
                  }}>
                    SKOR: {score}
                  </div>
                )}

                {minute && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: 'rgba(220,38,38,0.3)',
                    border: '2px solid #EF4444',
                    padding: '10px 18px',
                    borderRadius: '8px',
                    fontWeight: '900',
                    fontSize: '20px',
                    color: '#FEE2E2'
                  }}>
                    {minute}
                  </div>
                )}
              </div>
            )}

            {/* Headline (Title) - MAXIMUM CONTRAST */}
            <h1 style={{
              fontSize: title.length > 50 ? '54px' : '64px',
              fontWeight: '900',
              lineHeight: 1.15,
              margin: '0 0 30px 0',
              letterSpacing: '-1px',
              textShadow: '0 4px 16px rgba(0,0,0,0.8)',
              color: colors.beyaz
            }}>
              {title}
            </h1>

            {/* Sub-headline (Summary) */}
            {summary && (
              <p style={{
                fontSize: '28px',
                fontWeight: '500',
                color: '#E2E8F0',
                lineHeight: 1.4,
                margin: 0,
                opacity: 0.9,
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden'
              }}>
                {summary}
              </p>
            )}

            {/* BRANDING FOOTER (Strictly BordoMavi) */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              marginTop: 'auto',
              paddingTop: '20px',
              borderTop: '2px solid rgba(255,255,255,0.15)'
            }}>
              <span style={{ fontSize: '28px', fontWeight: '900', color: '#FFFFFF', letterSpacing: '1px' }}>
                BordoMavi
              </span>
              <span style={{ fontSize: '20px', fontWeight: '700', color: '#38BDF8' }}>
                #Trabzonspor #BordoMavi
              </span>
            </div>
          </div>

          {/* BRANDING ENGINE (Sağ Alt: Kullanıcının Orijinal Dairesel BordoMavi Logosu) */}
          {logoDataUrl && (
            <div style={{
              position: 'absolute',
              bottom: '36px',
              right: '48px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#FFFFFF',
              borderRadius: '9999px',
              border: '3px solid #F59E0B',
              padding: '8px',
              boxShadow: '0 12px 32px rgba(0,0,0,0.7)',
              zIndex: 15
            }}>
              <img
                src={logoDataUrl}
                width={136}
                height={136}
                style={{ 
                  display: 'block',
                  borderRadius: '9999px',
                  objectFit: 'contain'
                }}
              />
            </div>
          )}

          {/* VIGNETTE ENGINE (Kenar Karartmalari) */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            boxShadow: 'inset 0 0 150px rgba(0,0,0,0.5)',
            pointerEvents: 'none',
            zIndex: 20
          }} />
        </div>
      ),
      {
        width: canvasWidth,
        height: canvasHeight,
      }
    );
  } catch (error) {
    console.error('OG Image Generation Error (Failsafe activated):', error);
    // Asla 500 dönme! Facebook'un ve uygulamanın görselsiz kalmaması için garantili kurumsal görsel üret.
    return new ImageResponse(
      (
        <div style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #7B0F1C 0%, #121E35 60%, #2E8BC9 100%)',
          color: '#FFFFFF',
          padding: '60px',
          fontFamily: 'sans-serif',
          position: 'relative'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#FFFFFF',
            borderRadius: '9999px',
            border: '4px solid #F59E0B',
            padding: '12px',
            marginBottom: '30px',
            boxShadow: '0 12px 32px rgba(0,0,0,0.6)'
          }}>
            <img src={BORDOMAVI_BRAND_LOGO_DATA_URI} width={130} height={130} style={{ borderRadius: '9999px' }} />
          </div>
          <h1 style={{ fontSize: '48px', fontWeight: '900', textAlign: 'center', margin: '0 0 20px 0' }}>
            BordoMavi Özel Haber
          </h1>
          <p style={{ fontSize: '24px', fontWeight: '700', color: '#38BDF8', margin: 0 }}>
            #Trabzonspor #BordoMavi
          </p>
        </div>
      ),
      { width: 1200, height: 630 }
    );
  }
}