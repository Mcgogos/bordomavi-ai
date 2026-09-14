import { VisualTemplateType } from './TemplateSelector';

export class ImageGenerator {
  public static readonly GLOBAL_NEGATIVE_PROMPT = "no logo, no text, no typography, no letters, no watermark, no fake brand, no sponsor logo, no deformed logo, no writing";
  public static readonly GLOBAL_POSITIVE_BASE = "editorial sports photography, premium sports media visual, cinematic lighting, ultra photorealistic, 8k, high contrast, clean composition with negative space on left side for title overlay, bottom-right corner empty and dark for logo safe zone";

  public static getPromptForTemplate(template: VisualTemplateType): string {
    let specificPrompt = "";
    
    switch (template) {
      case VisualTemplateType.PRE_MATCH:
        specificPrompt = "Trabzonspor Papara Park stadium night atmosphere, dramatic stadium lights, bordo #7B0F1C and mavi #2E8BC9 light leaks, smoke and particles, dynamic";
        break;
      case VisualTemplateType.POST_MATCH:
        specificPrompt = "Trabzonspor stadium celebration atmosphere, night, dramatic lights, fog on pitch, empty space for big score, bordo-mavi bokeh";
        break;
      case VisualTemplateType.TRANSFER:
        specificPrompt = "Dark navy studio background #121E35, abstract geometric bordo and blue light streaks, premium transfer announcement background, clean space for player silhouette on right";
        break;
      case VisualTemplateType.BREAKING:
        specificPrompt = "Intense dark background with bordo and blue gradient, high contrast, breaking news premium portal background, light particles, urgent";
        break;
      case VisualTemplateType.PLAYER_PERFORMANCE:
        specificPrompt = "Dark modern sports stats background, subtle hexagonal pattern, bordo-mavi accent lights, space for player and stats cards";
        break;
      case VisualTemplateType.GENERAL_NEWS:
      default:
        specificPrompt = "Abstract editorial news background, Trabzonspor bordo-mavi theme, modern news portal aesthetic, blurred";
        break;
    }

    return `${this.GLOBAL_POSITIVE_BASE}, ${specificPrompt}`;
  }

  public static async generateBackground(template: VisualTemplateType): Promise<string> {
    const prompt = this.getPromptForTemplate(template);
    console.log("[ImageGenerator] Generated Prompt:", prompt);
    console.log("[ImageGenerator] Negative Prompt:", this.GLOBAL_NEGATIVE_PROMPT);
    
    // In a real application, call Gemini Imagen or DALL-E 3 here with the prompt.
    // For this prototype, we'll return a deterministic simulated background URL
    // based on the template type that can be used by the OG Route.
    
    // Simulate generation delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Returning an identifier so OG engine knows what abstract background to draw
    return `bg_${template.toLowerCase()}`;
  }
}
