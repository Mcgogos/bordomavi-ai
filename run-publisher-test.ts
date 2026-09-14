import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
import { publishReadyContent } from './src/lib/content/content-publisher';

(async () => {
  try {
    console.log("Starting publisher test...");
    const result = await publishReadyContent(1);
    console.log("Result:", JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Error:", error);
  }
})();
