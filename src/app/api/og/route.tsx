import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { TRABZONSPOR_CANVA_TEMPLATES, CanvaTemplate } from '@/lib/canva/canva-service';
import { BORDOMAVI_BRAND_LOGO_DATA_URI } from '@/lib/canva/brand-logo-data';

function resolveCanvaTemplate(
  requestedCategory: string | undefined,
  title: string,
  summary: string
): CanvaTemplate {
  if (requestedCategory) {
    const found = TRABZONSPOR_CANVA_TEMPLATES.find(
      (t) => t.category === requestedCategory.toUpperCase() || t.id === requestedCategory
    );
    if (found) return found;
  }

  const text = `${title} ${summary}`.toLocaleLowerCase('tr-TR');
  if (/(transfer|imza|kadroya|anla[sş]ma|bonservis|teklif)/i.test(text)) {
    return TRABZONSPOR_CANVA_TEMPLATES.find((t) => t.category === 'TRANSFER')!;
  }
  if (/(ilk\s*11|11'i|kadrosu\s*belli)/i.test(text)) {
    return TRABZONSPOR_CANVA_TEMPLATES.find((t) => t.category === 'LINEUP')!;
  }
  if (/(goool|gol\b|[sş]ut|asist)/i.test(text)) {
    return TRABZONSPOR_CANVA_CANVA_FALLBACK('GOAL');
  }
  if (/(ma[cç]\s*sonucu|galibiyet|3\s*puan|ma[cç]\s*bitti)/i.test(text)) {
    return TRABZONSPOR_CANVA_CANVA_FALLBACK('RESULT');
  }
  if (/(ma[cç]\s*g[üu]n[üu]|derbi|deplasman|papara\s*park)/i.test(text)) {
    return TRABZONSPOR_CANVA_CANVA_FALLBACK('MATCH_DAY');
  }
  if (/(hakem|penalt[ıi]|k[ıi]rm[ıi]z[ıi]\s*kart|var\s*karar)/i.test(text)) {
    return TRABZONSPOR_CANVA_CANVA_FALLBACK('PENALTY_CARD');
  }
  if (/(a[cç][ıi]klama|deme[cç]|bas[ıi]n\s*toplant[ıi]s[ıi]|konu[sş]tu)/i.test(text)) {
    return TRABZONSPOR_CANVA_CANVA_FALLBACK('QUOTE');
  }
  if (/(resmi|kamuoyu|duyuru|kul[üu]b[üu]m[üu]z)/i.test(text)) {
    return TRABZONSPOR_CANVA_CANVA_FALLBACK('OFFICIAL');
  }
  return TRABZONSPOR_CANVA_TEMPLATES[0];
}

function TRABZONSPOR_CANVA_CANVA_FALLBACK(cat: string): CanvaTemplate {
  return (
    TRABZONSPOR_CANVA_TEMPLATES.find((t) => t.category === cat) || TRABZONSPOR_CANVA_TEMPLATES[0]
  );
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawTitle = searchParams.get('title') || "Trabzonspor'da Flaş Gelişme!";
    const title = rawTitle
      .replace(/\*\*/g, '')
      .replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, '$1$2$3')
      .trim();
    const rawSummary = searchParams.get('summary') || '';
    const summary = rawSummary
      .replace(/\*\*/g, '')
      .replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, '$1$2$3')
      .trim();
    const externalImageUrl = searchParams.get('imageUrl') || null;

    const requestedTemplate = searchParams.get('template')?.toUpperCase();
    const minute = searchParams.get('minute');
    const score = searchParams.get('score');
    const format = searchParams.get('format')?.toLowerCase();

    const canvaTemplate = resolveCanvaTemplate(requestedTemplate, title, summary);
    const isVertical = requestedTemplate === 'REELS' || format === 'vertical' || format === 'reels';
    const canvasWidth = isVertical ? 1080 : 1200;
    const canvasHeight = isVertical ? 1920 : 630;

    const logoDataUrl = BORDOMAVI_BRAND_LOGO_DATA_URI;

    let safeExternalImageDataUrl: string | null = null;
    const isSafeUrl = Boolean(
      externalImageUrl &&
        (externalImageUrl.startsWith('http://') || externalImageUrl.startsWith('https://')) &&
        !externalImageUrl.includes('localhost') &&
        !externalImageUrl.includes('127.0.0.1') &&
        !externalImageUrl.includes('169.254.') &&
        !externalImageUrl.includes('[::1]')
    );

    if (isSafeUrl && externalImageUrl) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);
        const imgRes = await fetch(externalImageUrl, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'image/jpeg,image/png,image/*;q=0.8',
          },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (imgRes.ok) {
          const contentType = (imgRes.headers.get('content-type') || '').toLowerCase();
          if (
            contentType.includes('jpeg') ||
            contentType.includes('jpg') ||
            contentType.includes('png')
          ) {
            const arrayBuffer = await imgRes.arrayBuffer();
            const mime = contentType.includes('png') ? 'image/png' : 'image/jpeg';
            safeExternalImageDataUrl = `data:${mime};base64,${Buffer.from(arrayBuffer).toString(
              'base64'
            )}`;
          }
        }
      } catch (e) {
        console.warn('[OG Route] Harici görsel indirilemedi, Canva kurumsal zemin kullanılıyor:', e);
      }
    }

    const primaryColor = canvaTemplate.primaryColor || '#781324';
    const accentColor = canvaTemplate.accentColor || '#38BDF8';
    const badgeText = canvaTemplate.badgeText || '🔥 BORDO MAVİ GÜNDEM';

    if (isVertical) {
      return new ImageResponse(
        (
          <div
            style={{
              height: '100%',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#070B14',
              color: '#FFFFFF',
              position: 'relative',
              overflow: 'hidden',
              fontFamily: 'sans-serif',
              justifyContent: 'space-between',
              padding: '70px 64px 80px 64px',
            }}
          >
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
                    objectFit: 'cover',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    background: `linear-gradient(155deg, ${primaryColor}CC 0%, rgba(10,15,29,0.75) 45%, #070B14 100%)`,
                  }}
                />
              </>
            ) : (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  background: `linear-gradient(145deg, ${primaryColor} 0%, #0B1120 55%, ${accentColor}99 100%)`,
                }}
              />
            )}

            {/* Canva Çerçeve Border */}
            <div
              style={{
                position: 'absolute',
                top: '28px',
                left: '28px',
                right: '28px',
                bottom: '28px',
                border: '3px solid rgba(255,255,255,0.18)',
                borderRadius: '24px',
                pointerEvents: 'none',
              }}
            />

            {/* Sağ Üst Köşede 2x Bordo-Mavi Logosu */}
            {logoDataUrl && (
              <div
                style={{
                  position: 'absolute',
                  top: '52px',
                  right: '52px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#FFFFFF',
                  borderRadius: '9999px',
                  border: '4px solid #F59E0B',
                  padding: '8px',
                  boxShadow: '0 12px 32px rgba(0,0,0,0.75)',
                  zIndex: 20,
                }}
              >
                <img
                  src={logoDataUrl}
                  width={156}
                  height={156}
                  style={{ borderRadius: '9999px', objectFit: 'contain' }}
                />
              </div>
            )}

            {/* Alt Manşet Alanı */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                width: '100%',
                zIndex: 10,
                marginTop: 'auto',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: primaryColor,
                  border: `2px solid ${accentColor}`,
                  borderRadius: '12px',
                  padding: '10px 24px',
                  alignSelf: 'flex-start',
                  marginBottom: '24px',
                }}
              >
                <span
                  style={{
                    fontSize: '24px',
                    fontWeight: '900',
                    color: '#FFFFFF',
                    letterSpacing: '1.5px',
                  }}
                >
                  {badgeText}
                </span>
              </div>

              <h1
                style={{
                  fontSize: title.length > 60 ? '56px' : '68px',
                  fontWeight: '900',
                  lineHeight: 1.15,
                  color: '#FFFFFF',
                  margin: '0 0 24px 0',
                  textShadow: '0 6px 24px rgba(0,0,0,0.9)',
                }}
              >
                {title}
              </h1>

              {summary && (
                <p
                  style={{
                    fontSize: '32px',
                    fontWeight: '500',
                    color: '#E2E8F0',
                    lineHeight: 1.35,
                    margin: '0 0 36px 0',
                  }}
                >
                  {summary}
                </p>
              )}

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: '28px',
                  borderTop: '3px solid rgba(255,255,255,0.2)',
                  width: '100%',
                }}
              >
                <span
                  style={{
                    fontSize: '28px',
                    fontWeight: '900',
                    color: '#FFFFFF',
                    letterSpacing: '1px',
                  }}
                >
                  BordoMavi
                </span>
                <span style={{ fontSize: '24px', fontWeight: '800', color: '#38BDF8' }}>
                  #Trabzonspor #BordoMavi
                </span>
              </div>
            </div>
          </div>
        ),
        { width: 1080, height: 1920 }
      );
    }

    // YATAY CANVA HABER KARTI (1200x630)
    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            backgroundColor: '#0A0F1D',
            color: '#FFFFFF',
            position: 'relative',
            overflow: 'hidden',
            fontFamily: 'sans-serif',
          }}
        >
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
                  objectFit: 'cover',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  background: `linear-gradient(135deg, ${primaryColor}E6 0%, rgba(11,17,32,0.88) 55%, ${accentColor}CC 100%)`,
                }}
              />
            </>
          ) : (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                background: `linear-gradient(135deg, ${primaryColor} 0%, #0B1120 55%, ${accentColor} 100%)`,
              }}
            />
          )}

          {/* Canva Stüdyo Çapraz Işık Hüzmesi */}
          <div
            style={{
              position: 'absolute',
              top: '-20%',
              right: '18%',
              width: '220px',
              height: '150%',
              backgroundColor: 'rgba(255,255,255,0.06)',
              transform: 'rotate(18deg)',
            }}
          />

          {/* Canva Stüdyo Çerçeve Border */}
          <div
            style={{
              position: 'absolute',
              top: '20px',
              left: '20px',
              right: '20px',
              bottom: '20px',
              border: '2px solid rgba(255,255,255,0.18)',
              borderRadius: '18px',
              pointerEvents: 'none',
              zIndex: 5,
            }}
          />

          {/* Sol Karartma Katmanı */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: '80%',
              background:
                'linear-gradient(to right, rgba(10,15,29,0.92) 0%, rgba(10,15,29,0.65) 65%, transparent 100%)',
              zIndex: 2,
            }}
          />

          {/* Ana İçerik Alanı */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              paddingLeft: '64px',
              paddingRight: '240px',
              paddingTop: '44px',
              paddingBottom: '44px',
              width: '100%',
              height: '100%',
              zIndex: 10,
            }}
          >
            {/* Canva Kategori Rozeti + Canlı Skor */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                marginBottom: '20px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: primaryColor,
                  border: `2px solid ${accentColor}`,
                  padding: '8px 20px',
                  borderRadius: '9999px',
                  fontWeight: '900',
                  fontSize: '20px',
                  letterSpacing: '1px',
                  color: '#FFFFFF',
                  boxShadow: '0 6px 18px rgba(0,0,0,0.45)',
                }}
              >
                {badgeText}
              </div>

              {score && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: 'rgba(255,255,255,0.15)',
                    border: '2px solid rgba(255,255,255,0.4)',
                    padding: '8px 18px',
                    borderRadius: '9999px',
                    fontWeight: '900',
                    fontSize: '20px',
                    color: '#FFFFFF',
                  }}
                >
                  SKOR: {score}
                </div>
              )}

              {minute && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: 'rgba(220,38,38,0.35)',
                    border: '2px solid #EF4444',
                    padding: '8px 16px',
                    borderRadius: '9999px',
                    fontWeight: '900',
                    fontSize: '18px',
                    color: '#FEE2E2',
                  }}
                >
                  {minute}
                </div>
              )}
            </div>

            {/* Manşet */}
            <h1
              style={{
                fontSize: title.length > 55 ? '50px' : '60px',
                fontWeight: '900',
                lineHeight: 1.15,
                margin: '0 0 22px 0',
                letterSpacing: '-1px',
                textShadow: '0 4px 16px rgba(0,0,0,0.85)',
                color: '#FFFFFF',
              }}
            >
              {title}
            </h1>

            {/* Spot Metin */}
            {summary && (
              <p
                style={{
                  fontSize: '25px',
                  fontWeight: '500',
                  color: '#E2E8F0',
                  lineHeight: 1.38,
                  margin: 0,
                  opacity: 0.92,
                }}
              >
                {summary.length > 140 ? summary.slice(0, 137) + '...' : summary}
              </p>
            )}

            {/* Kurumsal Alt Bilgi Bandı */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                marginTop: 'auto',
                paddingTop: '18px',
                borderTop: '2px solid rgba(255,255,255,0.18)',
              }}
            >
              <span
                style={{
                  fontSize: '26px',
                  fontWeight: '900',
                  color: '#FFFFFF',
                  letterSpacing: '1px',
                }}
              >
                BordoMavi
              </span>
              <span style={{ fontSize: '20px', fontWeight: '800', color: '#FBBF24' }}>
                #Trabzonspor #BordoMavi
              </span>
            </div>
          </div>

          {/* Sağ Üst Köşede 2x Bordo-Mavi Logosu */}
          {logoDataUrl && (
            <div
              style={{
                position: 'absolute',
                top: '32px',
                right: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#FFFFFF',
                borderRadius: '9999px',
                border: '4px solid #F59E0B',
                padding: '8px',
                boxShadow: '0 12px 32px rgba(0,0,0,0.75)',
                zIndex: 15,
              }}
            >
              <img
                src={logoDataUrl}
                width={152}
                height={152}
                style={{
                  display: 'block',
                  borderRadius: '9999px',
                  objectFit: 'contain',
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
  } catch (error) {
    console.error('OG Image Generation Error (Failsafe activated):', error);
    return new ImageResponse(
      (
        <div
          style={{
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
            position: 'relative',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#FFFFFF',
              borderRadius: '9999px',
              border: '4px solid #F59E0B',
              padding: '12px',
              marginBottom: '30px',
              boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
            }}
          >
            <img
              src={BORDOMAVI_BRAND_LOGO_DATA_URI}
              width={130}
              height={130}
              style={{ borderRadius: '9999px' }}
            />
          </div>
          <h1
            style={{
              fontSize: '48px',
              fontWeight: '900',
              textAlign: 'center',
              margin: '0 0 20px 0',
            }}
          >
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
