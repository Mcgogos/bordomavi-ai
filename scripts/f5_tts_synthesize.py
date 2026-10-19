import os
import sys
import argparse
import json
import wave
import contextlib

# Add node_modules ffmpeg to PATH if not already present
node_ffmpeg = os.path.join(os.getcwd(), 'node_modules', 'ffmpeg-static')
if os.path.exists(node_ffmpeg):
    os.environ["PATH"] = node_ffmpeg + os.pathsep + os.environ.get("PATH", "")

def get_wav_duration(wav_path):
    try:
        with contextlib.closing(wave.open(wav_path, 'r')) as f:
            frames = f.getnframes()
            rate = f.getframerate()
            return round(frames / float(rate), 2)
    except Exception:
        return 20.0

def main():
    parser = argparse.ArgumentParser(description="F5-TTS Voice Cloning Inference CLI")
    parser.add_argument("--text", type=str, required=False, help="Text to synthesize")
    parser.add_argument("--text_file", type=str, required=False, help="Path to text file to synthesize")
    parser.add_argument("--ref_audio", type=str, required=True, help="Reference audio path (.wav or .mp3)")
    parser.add_argument("--ref_text", type=str, required=True, help="Transcript of the reference audio")
    parser.add_argument("--output_file", type=str, required=True, help="Output audio file path (.wav or .mp3)")
    parser.add_argument("--nfe_step", type=int, default=16, help="ODE steps (default: 16 for CPU)")
    parser.add_argument("--speed", type=float, default=1.05, help="Playback speed multiplier")
    args = parser.parse_args()

    gen_text = args.text
    if not gen_text and args.text_file and os.path.exists(args.text_file):
        with open(args.text_file, 'r', encoding='utf-8') as f:
            gen_text = f.read().strip()

    if not gen_text:
        print(json.dumps({"success": False, "error": "No text provided"}))
        sys.exit(1)

    try:
        import soundfile as sf
        import torch
        import torchaudio

        def sf_torchaudio_load(uri, *args, **kwargs):
            data, sr = sf.read(uri)
            t = torch.from_numpy(data).float()
            if t.ndim == 1:
                t = t.unsqueeze(0)
            elif t.ndim == 2:
                t = t.t()
            return t, sr

        torchaudio.load = sf_torchaudio_load

        from f5_tts.api import F5TTS

        f5tts = F5TTS(device="cpu")

        # F5-TTS works natively with wav output
        output_wav = args.output_file if args.output_file.endswith('.wav') else args.output_file + '.tmp.wav'
        
        wav, sr, spect = f5tts.infer(
            ref_file=args.ref_audio,
            ref_text=args.ref_text,
            gen_text=gen_text,
            file_wave=output_wav,
            nfe_step=args.nfe_step,
            speed=args.speed,
            target_rms=0.15
        )

        duration = get_wav_duration(output_wav)

        # If user requested mp3, convert with ffmpeg
        final_output = args.output_file
        if args.output_file.endswith('.mp3'):
            import subprocess
            cmd = ['ffmpeg', '-y', '-i', output_wav, '-b:a', '192k', args.output_file]
            subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
            try:
                os.remove(output_wav)
            except OSError:
                pass
        else:
            final_output = output_wav

        print(json.dumps({
            "success": True,
            "audio_path": final_output,
            "duration": duration,
            "engine": "F5-TTS"
        }))

    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e),
            "error_type": type(e).__name__
        }))
        sys.exit(1)

if __name__ == '__main__':
    main()
