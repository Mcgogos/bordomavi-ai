import { FacebookService } from './src/services/facebook.service';

// Next.js apps usually load .env automatically when running through next tools, 
// but for a bare tsx script we might need dotenv. Next.js `loadEnvConfig` is safer.
import { loadEnvConfig } from '@next/env';
const projectDir = process.cwd();
loadEnvConfig(projectDir);

(async () => {
  console.log("Testing Facebook Connection Settings...");
  const result = await FacebookService.testConnection();
  console.log("RESULT:", result);
})();
