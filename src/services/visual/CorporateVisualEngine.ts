import { TemplateSelector, VisualTemplateType } from './TemplateSelector';
import { ImageGenerator } from './ImageGenerator';

export class CorporateVisualEngine {
  /**
   * Primary entry point for AI content generation to prepare the visual context.
   */
  public static async prepareVisualContext(title: string, summary: string) {
    const template = TemplateSelector.selectTemplate(title, summary);
    const bgIdentifier = await ImageGenerator.generateBackground(template);
    
    return {
      template,
      bgIdentifier
    };
  }

  // --- RENDERING HELPERS FOR OG ROUTE ---

  public static getColors() {
    return {
      bordo: '#7B0F1C',
      mavi: '#2E8BC9',
      lacivert: '#121E35',
      beyaz: '#FFFFFF',
      gri: '#8A94A6'
    };
  }

  /**
   * Provides the Logo configuration (LogoOverlay / QualityControl)
   */
  public static getLogoConfig(canvasWidth: number, canvasHeight: number) {
    // Genişlik: canvas.width * 0.10 (%8-12 aralığı, default %10)
    const logoWidth = canvasWidth * 0.10;
    // Sağ alt köşe, sağdan %3 ve alttan %3 güvenli boşluk
    const safeMarginX = canvasWidth * 0.03;
    const safeMarginY = canvasHeight * 0.03;
    
    return {
      width: logoWidth,
      right: safeMarginX,
      bottom: safeMarginY,
      path: '/assets/brand/bordomavi-logo.png',
      containerStyle: {
        position: 'absolute' as const,
        bottom: `${safeMarginY}px`,
        right: `${safeMarginX}px`,
        padding: '8px',
        backgroundColor: 'rgba(255,255,255,0.9)',
        borderRadius: '12px',
        boxShadow: '0 8px 16px rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }
    };
  }

  /**
   * Provides the dark gradient for readability (OverlayEngine)
   */
  public static getReadabilityOverlay() {
    return {
      position: 'absolute' as const,
      left: 0,
      top: 0,
      bottom: 0,
      width: '60%', // Sol %60 alan başlık için boş ve hafif karartılabilir olmalı
      background: 'linear-gradient(to right, rgba(18, 30, 53, 0.9) 0%, rgba(18, 30, 53, 0.4) 60%, transparent 100%)',
      zIndex: 1
    };
  }
}
