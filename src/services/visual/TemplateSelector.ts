export enum VisualTemplateType {
  PRE_MATCH = 'PRE_MATCH',
  POST_MATCH = 'POST_MATCH',
  TRANSFER = 'TRANSFER',
  BREAKING = 'BREAKING',
  PLAYER_PERFORMANCE = 'PLAYER_PERFORMANCE',
  GENERAL_NEWS = 'GENERAL_NEWS'
}

export class TemplateSelector {
  public static selectTemplate(title: string, summary: string): VisualTemplateType {
    const text = (title + " " + summary).toLowerCase();
    
    if (text.includes("son dakika") || text.includes("flaş")) {
      return VisualTemplateType.BREAKING;
    }
    if (text.includes("transfer") || text.includes("imza") || text.includes("anlaştı")) {
      return VisualTemplateType.TRANSFER;
    }
    if (text.includes("maçı") || text.includes("ilk 11") || text.includes("kadro")) {
      return VisualTemplateType.PRE_MATCH;
    }
    if (text.includes("skor") || text.includes("maç sonucu") || text.includes("kazandı")) {
      return VisualTemplateType.POST_MATCH;
    }
    if (text.includes("performans") || text.includes("istatistik") || text.includes("gol") || text.includes("asist")) {
      return VisualTemplateType.PLAYER_PERFORMANCE;
    }
    return VisualTemplateType.GENERAL_NEWS;
  }
}
