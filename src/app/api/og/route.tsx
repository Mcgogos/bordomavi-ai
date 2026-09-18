import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { CorporateVisualEngine } from '@/services/visual/CorporateVisualEngine';
import { TemplateSelector, VisualTemplateType } from '@/services/visual/TemplateSelector';
import fs from 'fs';
import path from 'path';

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
    
    // 3. Setup Architecture Tools
    const logoConfig = CorporateVisualEngine.getLogoConfig(canvasWidth, canvasHeight);
    
    // Logo'yu Node.js fs ile okuyalim (ArrayBuffer Satori tarafindan desteklenir)
    const logoPath = path.join(process.cwd(), 'public/assets/brand/bordomavi-logo.png');
    let logoDataUrl = '';
    try {
      const logoBuffer = fs.readFileSync(logoPath);
      logoDataUrl = `data:image/png;base64,${logoBuffer.toString('base64')}`;
    } catch (e) {
      console.error("Logo okunamadi:", e);
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
          {/* EXTERNAL IMAGE BACKGROUND (If Available) */}
          {externalImageUrl ? (
            <>
              <img 
                src={externalImageUrl} 
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

          {/* BRANDING ENGINE (Bottom Right Logo) */}
          {logoDataUrl && (
            <div style={{
              position: 'absolute',
              bottom: '32px',
              right: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255,255,255,0.92)',
              borderRadius: '16px',
              padding: '10px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
              zIndex: 10
            }}>
              <img
                src={logoDataUrl}
                width={150}
                height={150}
                style={{ display: 'block' }}
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
    console.error('OG Image Generation Error:', error);
    return new Response('Failed to generate image', { status: 500 });
  }
}