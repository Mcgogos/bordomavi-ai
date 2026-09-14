import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
import { FacebookService } from './src/services/facebook.service';
(async () => {
  try {
    const res = await FacebookService.publishPost('Test via TSX File');
    console.log('RES:', res);
  } catch (err: any) {
    console.error('ERR:', err.message);
  }
})();
