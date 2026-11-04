import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { getFFmpegPath } from './reel-video-generator';

const execFileAsync = promisify(execFile);

export interface EarshotTakeMeta {
  id: string;
  role: string;
  file: string;
  dur_s: number;
  onset_s: number;
  peak_s: number;
  end_s: number;
  l50_lufs: number;
  offset_ms: number;
  bed_db: number;
  align: 'onset' | 'peak' | 'end';
}

export interface EarshotAudioMeasurements {
  lufs_i?: number;
  lufs_m_max?: number;
  true_peak_dbtp?: number;
  lra_lu?: number;
  centroid_hz?: number;
  digital_silence_frac?: number;
  summary?: string;
}

export interface EarshotCueEvent {
  timeSeconds: number;
  role: 'intro_hit' | 'whoosh_reveal' | 'scene_swish' | 'ui_pop' | 'cta_chime' | 'outro_lock';
  weight?: number;
}

const EARSHOT_KIT_DIR = path.join(process.cwd(), 'public', 'assets', 'audio', 'earshot-kit');
const EARSHOT_VENDOR_DIR = path.join(process.cwd(), 'vendor', 'earshot');

/**
 * vendor/earshot içindeki Python yürütücüsünü tespit eder (Windows .venv, Linux .venv veya sistem python3).
 */
export function getEarshotPythonPath(): string | null {
  const candidates = [
    path.join(EARSHOT_VENDOR_DIR, '.venv', 'Scripts', 'python.exe'),
    path.join(EARSHOT_VENDOR_DIR, '.venv', 'bin', 'python'),
    process.env.EARSHOT_PYTHON || '',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

/**
 * Earshot 0.4.0 ses bankasından (252 prosedürel ses efekti) BordoMavi Reels prodüksiyon kitini
 * (intro_hit, whoosh_reveal, scene_swish, ui_pop, cta_chime, outro_lock) üretir ve önbellekler.
 */
export async function ensureEarshotKitReady(): Promise<Record<string, EarshotTakeMeta>> {
  const lockPath = path.join(EARSHOT_KIT_DIR, 'bordomavi-earshot-lock.json');
  if (fs.existsSync(lockPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
      const allExist = Object.values(parsed as Record<string, EarshotTakeMeta>).every((t) =>
        fs.existsSync(path.join(EARSHOT_KIT_DIR, path.basename(t.file)))
      );
      if (allExist) {
        return parsed;
      }
    } catch {}
  }

  fs.mkdirSync(EARSHOT_KIT_DIR, { recursive: true });
  const py = getEarshotPythonPath();

  if (py && fs.existsSync(EARSHOT_VENDOR_DIR)) {
    try {
      const pyScript = `
import json, os, soundfile as sf
from earshot.forge import bank

out_dir = r"""${EARSHOT_KIT_DIR}"""
os.makedirs(out_dir, exist_ok=True)

specs = [
    {"role": "intro_hit",     "id": "cut_hit/sub",      "seed": 1, "dur": None, "apex": None, "pitch": None, "offset_ms": 0,   "bed_db": 6.5, "align": "onset"},
    {"role": "whoosh_reveal", "id": "whoosh_big/thump", "seed": 2, "dur": 0.65, "apex": 0.18, "pitch": None, "offset_ms": 37,  "bed_db": 5.5, "align": "peak"},
    {"role": "scene_swish",   "id": "swish/bright",     "seed": 3, "dur": 0.35, "apex": 0.12, "pitch": None, "offset_ms": 20,  "bed_db": 4.5, "align": "peak"},
    {"role": "ui_pop",        "id": "ui_pop/soft",      "seed": 4, "dur": None, "apex": None, "pitch": "A4", "offset_ms": -20, "bed_db": 4.0, "align": "onset"},
    {"role": "cta_chime",     "id": "notify/mid_tine",  "seed": 5, "dur": None, "apex": None, "pitch": "E5", "offset_ms": 0,   "bed_db": 6.0, "align": "onset"},
    {"role": "outro_lock",    "id": "cut_hit/punch",    "seed": 6, "dur": None, "apex": None, "pitch": None, "offset_ms": 0,   "bed_db": 5.5, "align": "onset"},
]

lock = {}
for s in specs:
    y, meta = bank.render(s["id"], seed=s["seed"], dur=s["dur"], apex=s["apex"], pitch=s["pitch"], peak_db=-1.5, sr=48000)
    fname = f"{s['role']}.wav"
    fpath = os.path.join(out_dir, fname)
    sf.write(fpath, y, 48000, subtype="PCM_16")
    lock[s["role"]] = {
        "id": s["id"],
        "role": s["role"],
        "file": fname,
        "dur_s": round(float(meta.get("dur_s", len(y)/48000.0)), 4),
        "onset_s": round(float(meta.get("onset_s", 0.005)), 4),
        "peak_s": round(float(meta.get("peak_s", 0.05)), 4),
        "end_s": round(float(meta.get("end_s", len(y)/48000.0)), 4),
        "l50_lufs": round(float(meta.get("lufs_m_max", -16.0)), 2),
        "offset_ms": s["offset_ms"],
        "bed_db": s["bed_db"],
        "align": s["align"],
    }

with open(os.path.join(out_dir, "bordomavi-earshot-lock.json"), "w", encoding="utf-8") as f:
    json.dump(lock, f, indent=2)
print("EARSHOT_KIT_READY")
`;
      const ffmpegDir = path.dirname(getFFmpegPath());
      const env = {
        ...process.env,
        PATH: `${ffmpegDir}${path.delimiter}${process.env.PATH || ''}`,
      };
      await execFileAsync(py, ['-c', pyScript], {
        cwd: EARSHOT_VENDOR_DIR,
        env,
        timeout: 30000,
      });

      if (fs.existsSync(lockPath)) {
        return JSON.parse(fs.readFileSync(lockPath, 'utf8'));
      }
    } catch (e: any) {
      console.warn('[EarshotEngine] Live kit render warning:', e.message);
    }
  }

  return {};
}

/**
 * Reels videosunun sahne geçişlerine, başlık girişine, altyazı değişimlerine ve takip çağrısına (CTA)
 * göre Earshot launch-preset kurallarına uygun (`offset_ms`, `align: onset|peak`, `min_gap_ms`)
 * 48kHz stereo ses tasarım katmanı (WAV) üretir.
 */
export async function renderEarshotSfxTrackForReel(params: {
  durationSeconds: number;
  cueTimesSeconds: number[];
  isViralReel?: boolean;
}): Promise<string | null> {
  try {
    const kitLock = await ensureEarshotKitReady();
    const roles = Object.keys(kitLock);
    if (roles.length === 0) return null;

    const dur = Math.max(8, Math.min(95, params.durationSeconds));
    const events: EarshotCueEvent[] = [];

    // 1. Açılış vuruşu ve whoosh (0.05s intro_hit + 0.35s whoosh_reveal)
    events.push({ timeSeconds: 0.05, role: 'intro_hit', weight: params.isViralReel ? 0.55 : 0.75 });
    events.push({ timeSeconds: 0.38, role: 'whoosh_reveal', weight: params.isViralReel ? 0.50 : 0.70 });

    // 2. Sahne / Altyazı geçiş efektleri (en az 2.2 saniye aralıklı — earshot space_run disiplini)
    let lastCueTime = 0.8;
    params.cueTimesSeconds.forEach((t, idx) => {
      if (t <= 0.8 || t >= dur - 2.2) return;
      if (t - lastCueTime < 2.4) return;
      lastCueTime = t;
      const role = idx % 2 === 0 ? 'ui_pop' : 'scene_swish';
      events.push({
        timeSeconds: t,
        role,
        weight: params.isViralReel ? 0.42 : 0.62,
      });
    });

    // 3. Kapanış / Takip Çağrısı (CTA) Zili (`notify/mid_tine` E5)
    if (dur >= 10) {
      events.push({
        timeSeconds: Math.max(1.8, +(dur - 2.4).toFixed(2)),
        role: 'cta_chime',
        weight: params.isViralReel ? 0.58 : 0.78,
      });
    }

    const ffmpeg = getFFmpegPath();
    const outWavPath = path.join(
      os.tmpdir(),
      `bm_earshot_sfx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.wav`
    );

    const inputs: string[] = [
      '-f',
      'lavfi',
      '-i',
      `anullsrc=channel_layout=stereo:sample_rate=48000:d=${dur.toFixed(2)}`,
    ];
    const filterParts: string[] = [];
    const mixLabels: string[] = ['[0:a]'];

    let inputIdx = 1;
    for (const ev of events) {
      const meta = kitLock[ev.role];
      if (!meta) continue;
      const wavFile = path.join(EARSHOT_KIT_DIR, path.basename(meta.file));
      if (!fs.existsSync(wavFile)) continue;

      // Earshot kit.place hesabı: align=='peak' ise peak_s noktası cue anına oturur + offset_ms uygulanır
      const syncPoint = meta.align === 'peak' ? meta.peak_s : meta.onset_s;
      const startSec = Math.max(0, ev.timeSeconds - syncPoint + meta.offset_ms / 1000);
      const delayMs = Math.round(startSec * 1000);
      const vol = (ev.weight ?? 0.6).toFixed(2);

      inputs.push('-i', wavFile);
      const lbl = `[sfx${inputIdx}]`;
      filterParts.push(
        `[${inputIdx}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,volume=${vol},adelay=${delayMs}|${delayMs}${lbl}`
      );
      mixLabels.push(lbl);
      inputIdx++;
    }

    if (inputIdx === 1) return null;

    const amixFilter = `${filterParts.join(';')};${mixLabels.join('')}amix=inputs=${inputIdx}:duration=first:dropout_transition=0:normalize=0,alimiter=limit=0.89[sfxOut]`;

    await execFileAsync(
      ffmpeg,
      [
        '-y',
        ...inputs,
        '-filter_complex',
        amixFilter,
        '-map',
        '[sfxOut]',
        '-ar',
        '48000',
        '-ac',
        '2',
        '-c:a',
        'pcm_s16le',
        '-t',
        dur.toFixed(2),
        outWavPath,
      ],
      { timeout: 25000 }
    );

    if (fs.existsSync(outWavPath) && fs.statSync(outWavPath).size > 1000) {
      console.log(
        `[EarshotEngine] 🎵 Rendered Earshot v0.4.0 SFX stem (${events.length} synced cues, ${dur.toFixed(1)}s): ${outWavPath}`
      );
      return outWavPath;
    }
  } catch (e: any) {
    console.warn('[EarshotEngine] SFX stem generation warning:', e.message);
  }
  return null;
}

/**
 * Earshot'ın model-free BS.1770 (`earshot measure`) analizörü ile üretilen Reels videosunun
 * ses yüksekliğini (LUFS), True Peak (dBTP), LRA ve spektral parlaklığını ölçer.
 */
export async function measureReelAudioWithEarshot(
  mediaFilePath: string
): Promise<EarshotAudioMeasurements | null> {
  const py = getEarshotPythonPath();
  if (!py || !fs.existsSync(EARSHOT_VENDOR_DIR) || !fs.existsSync(mediaFilePath)) {
    return null;
  }

  try {
    const ffmpegDir = path.dirname(getFFmpegPath());
    const env = {
      ...process.env,
      PATH: `${ffmpegDir}${path.delimiter}${process.env.PATH || ''}`,
    };
    const { stdout } = await execFileAsync(
      py,
      ['-m', 'earshot', 'measure', '--light', mediaFilePath, '--json'],
      {
        cwd: EARSHOT_VENDOR_DIR,
        env,
        timeout: 20000,
      }
    );
    const data = JSON.parse(stdout.trim());
    const result: EarshotAudioMeasurements = {
      lufs_i: data.lufs ?? data.loudness?.integrated_lufs ?? data.integrated_lufs,
      lufs_m_max: data.short_term_max_lufs ?? data.loudness?.momentary_max_lufs ?? data.momentary_max_lufs,
      true_peak_dbtp: data.true_peak_dbtp ?? data.loudness?.true_peak_dbtp,
      lra_lu: data.lra_lu ?? data.loudness?.lra_lu,
      centroid_hz: data.brightness_hz ?? data.centroid_hz ?? data.spectrum?.centroid_hz,
      digital_silence_frac: data.digital_silence_frac ?? data.envelope?.digital_silence_frac,
      summary: data.summary,
    };
    console.log(
      `[EarshotEngine] 🎧 Earshot Measure QA: LUFS=${result.lufs_i?.toFixed?.(1) ?? 'N/A'}, TruePeak=${
        result.true_peak_dbtp?.toFixed?.(1) ?? 'N/A'
      } dBTP, Brightness=${Math.round(result.centroid_hz || 0)} Hz`
    );
    return result;
  } catch (e: any) {
    console.warn('[EarshotEngine] earshot measure warning:', e.message?.slice(0, 160));
    return null;
  }
}
