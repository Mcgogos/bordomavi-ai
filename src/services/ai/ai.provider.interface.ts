export interface AIProvider {
  generateContent(prompt: string): Promise<string>;
  analyzeNews(newsData: any): Promise<any>;
}
