import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { CorporateVisualEngine } from '@/services/visual/CorporateVisualEngine';
import { TemplateSelector, VisualTemplateType } from '@/services/visual/TemplateSelector';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const title = searchParams.get('title') || 'Trabzonspor\'da Flaş Gelişme!';
    const summary = searchParams.get('summary') || '';
    
    // 1. TemplateSelector (Haber türünü analiz edip template seçer)
    const template = TemplateSelector.selectTemplate(title, summary);
    
    // 2. Colors
    const colors = CorporateVisualEngine.getColors();
    
    // Determine dynamic badge
    let badgeText = 'ÖZEL HABER';
    let badgeColor = colors.mavi;
    
    if (template === VisualTemplateType.BREAKING) {
      badgeText = 'SON DAKİKA';
      badgeColor = '#E30A17'; // Daha canlı bir kırmızı/bordo
    } else if (template === VisualTemplateType.TRANSFER) {
      badgeText = 'TRANSFER ATEŞİ';
      badgeColor = '#F59E0B'; // Daha canlı Gold/Yellow
    } else if (template === VisualTemplateType.PRE_MATCH) {
      badgeText = 'MAÇ GÜNÜ';
      badgeColor = '#0284C7'; // Canlı Mavi
    }

    const canvasWidth = 1200;
    const canvasHeight = 630;
    
    // 3. Setup Architecture Tools
    const logoConfig = CorporateVisualEngine.getLogoConfig(canvasWidth, canvasHeight);
    
    // Logo'yu Node.js fs ile okuyalim (ArrayBuffer Satori tarafindan desteklenir)
    const logoPath = path.join(process.cwd(), 'public/assets/brand/bordomavi-logo.png');
    let logoDataUrl = '';
    try {
      let appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.URL || "http://localhost:3000";
      if (appUrl.includes("*")) {
        appUrl = "https://bordomavi-ai-editor.netlify.app";
      }
      
      // Background imajını public klasöründen al
      const bgUrl = new URL("/images/bordo-mavi-bg.jpg", appUrl).toString();

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
          {/* DIKKAT CEKICI ARKA PLAN (Dinamik ve Sert Renk Gecisleri) */}
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

          {/* OVERLAY ENGINE: Sol taraf icin sert karartma */}
          <div style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: '75%', 
            background: 'linear-gradient(to right, rgba(10,15,29, 1) 0%, rgba(10,15,29, 0.8) 50%, transparent 100%)',
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
            {/* Top Badge */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: badgeColor,
              padding: '12px 32px',
              borderRadius: '8px', 
              fontWeight: '900',
              fontSize: '26px',
              letterSpacing: '3px',
              textTransform: 'uppercase',
              boxShadow: `0 8px 32px ${badgeColor}`, // Tek golge
              marginBottom: '40px',
              width: 'auto',
              alignSelf: 'flex-start',
              border: `2px solid rgba(255,255,255,0.2)`
            }}>
              {badgeText}
            </div>

            {/* Title */}
            <div
              style={{
                fontSize: title.length > 60 ? '58px' : '72px',
                fontWeight: '900',
                lineHeight: 1.15,
                color: colors.beyaz,
                textShadow: '0 8px 32px rgba(0,0,0,0.9)', // Tek golge
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                letterSpacing: '-1px'
              }}
            >
              {title}
            </div>

            {/* Alt cizgi */}
            <div style={{
              marginTop: '45px',
              display: 'flex',
              alignItems: 'center'
            }}>
               <div style={{ width: '60px', height: '6px', backgroundColor: '#E30A17' }} />
               <div style={{ width: '120px', height: '6px', backgroundColor: '#0284C7' }} />
            </div>
          </div>
          
          {/* LOGO OVERLAY - SATORI SAFE CSS */}
          {logoDataUrl && (
            <div style={{
              position: 'absolute',
              right: '40px',
              bottom: '40px',
              backgroundColor: 'rgba(255,255,255,0.95)',
              padding: '12px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 30px rgba(0,0,0,0.6)'
            }}>
              <img 
                src={logoDataUrl}
                style={{
                  width: '130px', 
                  height: '100px', 
                  objectFit: 'contain'
                }}
              />
            </div>
          )}
        </div>
      ),
      {
        width: canvasWidth,
        height: canvasHeight,
      }
    );
  } catch (e: any) {
    console.error("OG Generation Error:", e.message);
    return new Response('Failed to generate image', { status: 500 });
  }
}
