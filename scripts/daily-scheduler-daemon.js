/**
 * BordoMavi AI - Kesin Günlük Yayın Takvimi Arka Plan Zamanlayıcısı
 * 
 * 07:00 -> REELS (Sabah Bülteni)
 * 11:00 -> METİN HABERİ (Gün Ortası Bülteni)
 * 15:00 -> REELS (İkindi Gündemi)
 * 20:30 -> REELS (Akşam Ana Haber / Prime-Time)
 * 
 * Bu takvim dışına kesinlikle çıkılmaz, her gün tam vaktinde otomatik tekrarlanır.
 */

const http = require('http');
const https = require('https');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const LOG_FILE = path.join(__dirname, '..', 'scheduler-daemon.log');

function log(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}`;
  console.log(line);
  try { fs.appendFileSync(LOG_FILE, line + '\n', 'utf8'); } catch {}
}

const SCHEDULE_SLOTS = [
  { id: '07:00', hour: 7, minute: 0, type: 'REELS' },
  { id: '11:00', hour: 11, minute: 0, type: 'TEXT' },
  { id: '15:00', hour: 15, minute: 0, type: 'REELS' },
  { id: '20:30', hour: 20, minute: 30, type: 'REELS' }
];

const executedToday = new Set();

function getTurkeyTime() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }));
}

async function triggerSyncWorkflow() {
  log('⚡ Günlük Takvim Tetiklendi: /api/cron/sync-news çağrılıyor...');
  
  // Önce yerel Next.js dev server'a (port 3000) dene, yoksa npx tsx ile doğrudan modülü yürüt
  return new Promise((resolve) => {
    const req = http.request('http://localhost:3000/api/cron/sync-news?secret=test_secret', {
      method: 'POST',
      timeout: 120000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        log(`[API Response ${res.statusCode}] ${data.slice(0, 300)}`);
        resolve(true);
      });
    });

    req.on('error', (err) => {
      log(`[API Call Fallback] Local server unavailable (${err.message}). Doğrudan TS motoru tetikleniyor...`);
      const child = spawn('npx', ['tsx', path.join(__dirname, 'trigger_workflow.ts')], {
        cwd: path.join(__dirname, '..'),
        shell: true
      });
      child.stdout.on('data', d => console.log(d.toString().trim()));
      child.stderr.on('data', d => console.error(d.toString().trim()));
      child.on('close', code => {
        log(`[Direct TS Runner] Workflow bitti (Exit: ${code})`);
        resolve(code === 0);
      });
    });

    req.end();
  });
}

function checkSchedule() {
  const trNow = getTurkeyTime();
  const curHour = trNow.getHours();
  const curMin = trNow.getMinutes();
  const dateKey = trNow.toISOString().split('T')[0];

  for (const slot of SCHEDULE_SLOTS) {
    const slotKey = `${dateKey}_${slot.id}`;
    // Eğer saat ve dakika eşleşiyorsa ve bugün henüz tetiklenmediyse
    if (curHour === slot.hour && curMin === slot.minute) {
      if (!executedToday.has(slotKey)) {
        executedToday.add(slotKey);
        log(`🎯 [ZAMANLAYICI] ${slot.id} (${slot.type}) slot vakti geldi! Otomasyon başlatılıyor...`);
        triggerSyncWorkflow();
      }
    }
  }

  // Gece yarısı reset
  if (curHour === 0 && curMin === 1) {
    executedToday.clear();
  }
}

log('===========================================================');
log('🚀 BordoMavi AI Günlük Kesin Takvim Zamanlayıcısı Aktif!');
log('Takvim: 07:00 (Reels) | 11:00 (Metin) | 15:00 (Reels) | 20:30 (Reels)');
log('===========================================================');

// Her 30 saniyede bir kontrol et
setInterval(checkSchedule, 30000);
checkSchedule();
