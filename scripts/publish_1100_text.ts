import 'dotenv/config';
import { publishReadyContent } from '../src/lib/content/content-publisher';

async function main() {
  console.log('🚀 11:00 Gün Ortası Metin Haberi Otonom Yayını Başlatılıyor...');
  const result = await publishReadyContent(1, false);
  console.log('--- PUBLISH RESULT ---');
  console.log(JSON.stringify(result, null, 2));
}

main().catch(console.error).finally(() => process.exit(0));
