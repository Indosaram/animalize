"""Build each character's key sound bank from VoxCPM2 per-key takes.

input:  <gen>/<character>/<key>_<take>.wav (scripts/voxcpm-keys.py output), <keys.json> {key: spoken text}
output: public/banks/<character>/blips.m4a + blips.json {sprite, letters: {key: [start, end]}}

Every take's transcript comes from <gen>/heard.json (scripts/voxcpm-transcribe.py, run on the GPU PC); the take whose transcript is closest to the key's text wins
(ties go to the one with the most voiced sound). Silence is trimmed, length capped, loudness evened out.
usage: python3 scripts/build-voxcpm-bank.py <gen-dir> <keys.json> [character ...]
"""

import difflib
import glob
import json
import os
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor

import numpy as np
import pyworld as pw
import soundfile as sf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BANKS = os.path.join(ROOT, "public", "banks")
SR = 44100
TARGET_LEN = 0.2
GAP = 0.04
HEARD = {}
SAME_SOUND = {"q": ("cue", "kyu"), "r": ("ar",), "8": ("ate",), "2": ("too", "to"), "4": ("for",), "u": ("yu",)}


def kana(text):
    out = "".join(chr(ord(c) - 0x60) if "ァ" <= c <= "ヶ" else c for c in text)
    return "".join(c for c in out if "ぁ" <= c <= "ゖ" or c == "ー" or c.isalnum()).lower()


def load(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "s16le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.int16).astype(np.float64) / 32768


def heard_text(path):
    character, name = os.path.basename(os.path.dirname(path)), os.path.basename(path)
    return HEARD.get(character, {}).get(name, "")


def trim(y):
    win = int(0.01 * SR)
    env = np.sqrt(np.convolve(y**2, np.ones(win) / win, "same"))
    on = np.where(env > 0.08 * env.max())[0]
    if not len(on):
        return None
    s, e = max(0, on[0] - int(0.01 * SR)), min(len(y), on[-1] + int(0.02 * SR))
    return y[s:e].copy()


def shorten(clip):
    """Speed the take up to TARGET_LEN without changing its pitch or timbre (rubberband R3, formants kept)."""
    if len(clip) > TARGET_LEN * SR:
        with tempfile.TemporaryDirectory() as tmp:
            src, dst = os.path.join(tmp, "in.wav"), os.path.join(tmp, "out.wav")
            sf.write(src, clip, SR)
            subprocess.run(["rubberband", "-3", "-F", "-q", "-D", str(TARGET_LEN), src, dst], check=True, capture_output=True)
            clip, _ = sf.read(dst)
    clip = clip[: int(TARGET_LEN * SR)].copy()
    fade = int(0.004 * SR)
    clip[:fade] *= np.linspace(0, 1, fade)
    tail = min(len(clip) // 3, int(0.03 * SR))
    clip[-tail:] *= np.linspace(1, 0, tail) ** 2
    return clip


def voiced(clip):
    f0, _ = pw.harvest(clip, SR, f0_floor=70, f0_ceil=1200, frame_period=5)
    return float((f0 > 0).mean()), float(np.median(f0[f0 > 0])) if (f0 > 0).any() else 0.0


def score_take(path, key, text):
    heard = heard_text(path)
    clip = trim(load(path))
    if clip is None or len(clip) < int(0.06 * SR):
        return None
    vr, f0 = voiced(clip)
    target = kana(text)
    got = kana(heard)
    match = difflib.SequenceMatcher(None, target, got).ratio()
    literal = key.lower() if len(key) == 1 else None
    if literal and got.lower().strip("!?.。！？") == literal:
        match = 1.0
    if got in SAME_SOUND.get(key, ()):
        match = 1.0
    return match, vr, f0, heard, clip


def build(gen, keys, character):
    jobs = []
    for key, text in keys.items():
        for path in sorted(glob.glob(os.path.join(gen, character, f"{key}_*.wav"))):
            jobs.append((key, text, path))
    with ThreadPoolExecutor(8) as pool:
        scored = list(pool.map(lambda j: (j[0], j[1], score_take(j[2], j[0], j[1])), jobs))
    best = {}
    for key, text, s in scored:
        if s and (key not in best or (s[0], s[1]) > (best[key][0], best[key][1])):
            best[key] = s
    missing = [k for k in keys if k not in best]
    if missing:
        raise SystemExit(f"{character}: no usable take for {missing}")
    parts, letters, t = [], {}, 0.0
    gap = np.zeros(int(GAP * SR))
    for key in keys:
        clip = shorten(best[key][4])
        rms = float(np.sqrt((clip**2).mean()))
        clip = clip * min(0.16 / max(rms, 1e-6), 0.7 / max(float(np.abs(clip).max()), 1e-6))
        letters[key] = [round(t, 4), round(t + len(clip) / SR, 4)]
        parts.extend([clip, gap])
        t += (len(clip) + len(gap)) / SR
    folder = os.path.join(BANKS, character)
    os.makedirs(folder, exist_ok=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "s16le", "-ar", str(SR), "-ac", "1", "-i", "-",
                    "-c:a", "aac", "-b:a", "128k", os.path.join(folder, "blips.m4a")],
                   input=(np.clip(np.concatenate(parts), -1, 1) * 32767).astype(np.int16).tobytes(), check=True)
    json.dump({"sprite": "blips.m4a", "letters": letters}, open(os.path.join(folder, "blips.json"), "w"))
    report = {k: {"text": keys[k], "heard": best[k][3], "match": round(best[k][0], 2), "voiced": round(best[k][1], 2),
                  "f0": round(best[k][2])} for k in keys}
    return report


if __name__ == "__main__":
    gen, keys_path = sys.argv[1], sys.argv[2]
    HEARD.update(json.load(open(os.path.join(gen, "heard.json"), encoding="utf-8")))
    keys = json.load(open(keys_path, encoding="utf-8"))
    chars = sys.argv[3:] or sorted(d for d in os.listdir(gen) if os.path.isdir(os.path.join(gen, d)))
    full = {}
    for c in chars:
        full[c] = build(gen, keys, c)
        r = full[c]
        good = sum(1 for v in r.values() if v["match"] >= 0.6)
        print(c, f"keys {len(r)} | heard right {good}/{len(r)} | median voiced {np.median([v['voiced'] for v in r.values()]):.0%}"
              f" | median pitch {np.median([v['f0'] for v in r.values()]):.0f}Hz", flush=True)
    json.dump(full, open(os.path.join(gen, "bank-report.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
