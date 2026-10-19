import numpy as np
import wave
import struct
import math
import os
import subprocess

def generate_sports_broadcast_bed(output_wav, duration_sec=60, sample_rate=44100):
    total_samples = int(duration_sec * sample_rate)
    t = np.linspace(0, duration_sec, total_samples, endpoint=False)
    
    # 118 BPM timing
    bpm = 118.0
    beat_sec = 60.0 / bpm # ~0.508 sec
    bar_sec = beat_sec * 4 # ~2.034 sec
    
    # 1. Warm Sub Bass Groove (C - Eb - F - G)
    bass = np.zeros(total_samples, dtype=np.float32)
    notes = [65.41, 77.78, 87.31, 98.00] # C2, Eb2, F2, G2
    for i, note_freq in enumerate(notes):
        # Each note plays for 2 bars (8 beats)
        start_t = i * (bar_sec * 2)
        end_t = (i + 1) * (bar_sec * 2)
        idx = (t >= start_t) & (t < end_t)
        if np.any(idx):
            sub_t = t[idx]
            # Pulsing 8th notes
            beat_phase = (sub_t % (beat_sec / 2)) / (beat_sec / 2)
            env = np.exp(-beat_phase * 3.5)
            tone = np.sin(2 * np.pi * note_freq * sub_t) + 0.3 * np.sin(2 * np.pi * note_freq * 2 * sub_t)
            bass[idx] = tone * env * 0.4

    # Tile bass for the whole duration
    loop_len = int(bar_sec * 8 * sample_rate)
    if loop_len > 0 and loop_len < total_samples:
        repeats = int(np.ceil(total_samples / loop_len))
        bass = np.tile(bass[:loop_len], repeats)[:total_samples]
        
    # 2. Cinematic News Synth Pad (Urgent, professional broadcast chord)
    # Chord: C minor (C4: 261.63, Eb4: 311.13, G4: 392.00, Bb4: 466.16)
    pad = (
        0.20 * np.sin(2 * np.pi * 130.81 * t) + # C3
        0.15 * np.sin(2 * np.pi * 196.00 * t) + # G3
        0.12 * np.sin(2 * np.pi * 261.63 * t) + # C4
        0.10 * np.sin(2 * np.pi * 311.13 * t)   # Eb4
    )
    # Slow gentle modulation (chorus/phasing)
    lfo = 0.5 + 0.5 * np.sin(2 * np.pi * 0.25 * t)
    pad = pad * (0.6 + 0.4 * lfo) * 0.25
    
    # 3. Dynamic News Ticker Pulse (High-tech studio rhythm)
    ticker = np.zeros(total_samples, dtype=np.float32)
    # 16th note ticker
    step_sec = beat_sec / 4 # ~0.127s
    step_samples = int(step_sec * sample_rate)
    num_steps = total_samples // step_samples
    for s in range(num_steps):
        s_start = s * step_samples
        s_end = min(total_samples, s_start + step_samples)
        st = t[s_start:s_end] - t[s_start]
        decay = np.exp(-st * 28.0)
        # Accent on downbeats
        accent = 1.6 if (s % 4 == 0) else 0.7
        freq = 1400.0 if (s % 4 == 0) else 900.0
        ticker[s_start:s_end] = np.sin(2 * np.pi * freq * st) * decay * 0.08 * accent
        
    # 4. Subtle Stadium Atmosphere (filtered low rumble/swell)
    noise = np.random.normal(0, 1, total_samples).astype(np.float32)
    # Moving average filter for warm stadium air
    window = 120
    stadium_air = np.convolve(noise, np.ones(window)/window, mode='same')
    # Stadium swell (breathing crowd energy)
    stadium_lfo = 0.5 + 0.5 * np.sin(2 * np.pi * 0.08 * t)
    stadium_air = stadium_air * (0.05 * stadium_lfo)
    
    # Master Mix
    mix_left = bass * 0.45 + pad * 0.40 + ticker * 0.35 + stadium_air
    mix_right = bass * 0.45 + pad * 0.40 + np.roll(ticker, 120) * 0.35 + np.roll(stadium_air, 300)
    
    # Smooth fade-in (1.5s) and fade-out (2.0s)
    fade_in_samples = int(1.5 * sample_rate)
    fade_out_samples = int(2.0 * sample_rate)
    fade_in = np.linspace(0, 1, fade_in_samples)
    fade_out = np.linspace(1, 0, fade_out_samples)
    
    mix_left[:fade_in_samples] *= fade_in
    mix_right[:fade_in_samples] *= fade_in
    mix_left[-fade_out_samples:] *= fade_out
    mix_right[-fade_out_samples:] *= fade_out
    
    # Normalize to -1.0 .. 1.0 (headroom ~0.8)
    max_val = max(np.max(np.abs(mix_left)), np.max(np.abs(mix_right)))
    if max_val > 0:
        mix_left = (mix_left / max_val) * 0.8
        mix_right = (mix_right / max_val) * 0.8
        
    # Write 16-bit stereo WAV
    int_left = (mix_left * 32767).astype(np.int16)
    int_right = (mix_right * 32767).astype(np.int16)
    interleaved = np.empty((total_samples * 2,), dtype=np.int16)
    interleaved[0::2] = int_left
    interleaved[1::2] = int_right
    
    with wave.open(output_wav, 'wb') as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(interleaved.tobytes())
        
    print(f"Generated broadcast bed: {output_wav} ({os.path.getsize(output_wav)} bytes)")

if __name__ == '__main__':
    out_path = 'public/assets/audio/sports_broadcast_bed.wav'
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    generate_sports_broadcast_bed(out_path)
