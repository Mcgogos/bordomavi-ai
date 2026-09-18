const fs = require('fs');
const path = require('path');

const envFile = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
let hookUrl = '';
for (const line of envFile.split('\n')) {
  if (line.trim().startsWith('VERCEL_DEPLOY_HOOK_URL=')) {
    hookUrl = line.trim().slice('VERCEL_DEPLOY_HOOK_URL='.length).replace(/["']/g, '').trim();
  }
}

if (!hookUrl) {
  console.error('[Vercel Deploy] HATA: VERCEL_DEPLOY_HOOK_URL bulunamadı!');
  process.exit(1);
}

console.log('[Vercel Deploy] Vercel dağıtımı tetikleniyor...');

(async () => {
  try {
    const res = await fetch(hookUrl, { method: 'POST' });
    const data = await res.json();
    console.log('✅ [Vercel Deploy] Başarıyla tetiklendi! İş ID:', data.job?.id, '| Durum:', data.job?.state);
  } catch (e) {
    console.error('❌ [Vercel Deploy] Hata:', e.message);
  }
})();
