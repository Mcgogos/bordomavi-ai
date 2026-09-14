import { FacebookService } from './src/services/facebook.service';
import { loadEnvConfig } from '@next/env';
const projectDir = process.cwd();
loadEnvConfig(projectDir);

(async () => {
  console.log("Testing REAL Meta Graph API Connection (GET Request)...");
  const result = await FacebookService.verifyRealConnection();
  console.log("RESULT:", JSON.stringify(result, null, 2));
})();
