"""Build per-character syllable banks from verified character clips.

Each clip in public/local-packs/<character>/ is a line already checked to be that character.
Every clip is transcribed with whisper (token timings), tokens are split into kana morae on the
energy envelope, and all morae are packed into public/banks/<character>/bank.m4a + bank.json.
Clips with no usable morae (sighs, laughs) go in whole so every clip still contributes.

usage: python3 scripts/build-syllable-banks.py [character ...]
"""

import json
import os
import re
import subprocess
import sys
import tempfile

import numpy as np
import pykakasi

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PACKS = os.path.join(ROOT, "public", "local-packs")
BANKS = os.path.join(ROOT, ".omo", "syllables")
CLEAN = os.path.join(ROOT, ".omo", "clean-packs")
WHISPER_MODEL = os.path.expanduser("~/.local/share/whisper/ggml-large-v3-turbo.bin")
SR = 16000
OUT_SR = 44100
PAD = 0.5
K = pykakasi.kakasi()
SMALL = set("ゃゅょぁぃぅぇぉゎ")
HALLUCINATION = re.compile("ご視聴|ありがとうございました|チャンネル|字幕|おつかれさま|お疲れ様")


def load(path, sr):
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(sr), "-f", "s16le", "-"],
        capture_output=True,
        check=True,
    ).stdout
    return np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768


def transcribe(x):
    padded = np.concatenate([np.zeros(int(PAD * SR), np.float32), x, np.zeros(int(PAD * SR), np.float32)])
    with tempfile.TemporaryDirectory() as tmp:
        wav = os.path.join(tmp, "c.wav")
        subprocess.run(
            ["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-", wav],
            input=padded.tobytes(),
            check=True,
        )
        subprocess.run(
            ["whisper-cli", "-m", WHISPER_MODEL, "-l", "ja", "-ojf", "-of", wav[:-4], "-f", wav],
            capture_output=True,
            check=True,
        )
        return json.load(open(wav[:-4] + ".json"))["transcription"]


def morae(hira):
    out = []
    for ch in hira:
        if ch in SMALL and out:
            out[-1] += ch
        elif ch in "ー〜~" and out:
            out[-1] += "ー"
        elif ch == "っ":
            out.append("っ")
        elif "\u3041" <= ch <= "\u3096":
            out.append(ch)
    return out


def romaji(m):
    return "".join(x["hepburn"] for x in K.convert(m.replace("ー", "")))


def envelope(x):
    w = SR // 100
    n = len(x) // w
    return np.sqrt((x[: n * w].reshape(n, w) ** 2).mean(axis=1) + 1e-9)


def split_token(env, a, b, n):
    seg = env[a:b]
    if len(seg) < 3:
        return None
    idx = np.where(seg > max(0.015, seg.max() * 0.12))[0]
    if not len(idx):
        return None
    s, e = a + idx[0], a + idx[-1] + 1
    step = (e - s) / n
    bounds = [s]
    for k in range(1, n):
        c = int(s + k * step)
        lo, hi = max(s + 1, c - 4), min(e - 1, c + 4)
        bounds.append(lo + int(np.argmin(env[lo : hi + 1])) if hi > lo else c)
    bounds.append(e)
    return bounds


def clip_morae(x):
    env = envelope(x)
    found = []
    for seg in transcribe(x):
        if HALLUCINATION.search(seg["text"]):
            continue
        for t in seg["tokens"]:
            txt = t["text"].strip()
            if not txt or txt.startswith("["):
                continue
            ms = morae("".join(c["hira"] for c in K.convert(txt)))
            if not ms:
                continue
            a = max(0, int(t["offsets"]["from"] / 10 - PAD * 100))
            b = min(len(env), int(t["offsets"]["to"] / 10 - PAD * 100))
            bounds = split_token(env, a, b, len(ms))
            if not bounds:
                continue
            for k, m in enumerate(ms):
                s0, s1 = bounds[k] / 100, bounds[k + 1] / 100
                if m != "っ" and s1 - s0 >= 0.06:
                    found.append((romaji(m), s0, min(s1, s0 + 0.32)))
    return found


def denoise(y):
    """Silence everything below the voice: frames under 12% of the slice's own peak energy are muted."""
    w = int(0.005 * OUT_SR)
    n = len(y) // w
    if n < 2:
        return y
    env = np.sqrt((y[: n * w].reshape(n, w) ** 2).mean(axis=1) + 1e-12)
    gate = np.clip((env / env.max() - 0.06) / 0.06, 0, 1)
    gain = np.repeat(np.convolve(gate, np.ones(3) / 3, "same"), w)
    out = y.copy()
    out[: len(gain)] *= gain
    out[len(gain) :] = 0
    return out


def build(character):
    names = json.load(open(os.path.join(PACKS, "index.json")))[character]
    gap = np.zeros(int(0.04 * OUT_SR), np.float32)
    parts, rows, t, whole = [], [], 0.0, 0
    for name in names:
        path = os.path.join(PACKS, character, name)
        clean = os.path.join(CLEAN, character, name.rsplit(".", 1)[0] + ".wav")
        hi = load(clean if os.path.exists(clean) else path, OUT_SR)
        pieces = clip_morae(load(path, SR))
        if not pieces:
            pieces = [("ha", 0.0, min(len(hi) / OUT_SR, 0.6))]
            whole += 1
        for r, s0, s1 in pieces:
            y = denoise(hi[int(s0 * OUT_SR) : int(s1 * OUT_SR)].copy())
            if not len(y) or not r:
                continue
            fade = min(len(y) // 4, int(0.008 * OUT_SR))
            if fade:
                y[:fade] *= np.linspace(0, 1, fade)
                y[-fade:] *= np.linspace(1, 0, fade)
            y *= 0.7 / max(1e-6, float(np.abs(y).max()))
            rows.append([r, round(t, 4), round(t + len(y) / OUT_SR, 4)])
            parts.extend([y, gap])
            t += (len(y) + len(gap)) / OUT_SR
    out = os.path.join(BANKS, character)
    os.makedirs(out, exist_ok=True)
    pcm = (np.concatenate(parts) * 32767).astype(np.int16).tobytes()
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-f", "s16le", "-ar", str(OUT_SR), "-ac", "1", "-i", "-",
         "-c:a", "aac", "-b:a", "96k", os.path.join(out, "bank.m4a")],
        input=pcm,
        check=True,
    )
    json.dump({"sprite": "bank.m4a", "syllables": rows}, open(os.path.join(out, "bank.json"), "w"), ensure_ascii=False)
    kinds = sorted({r[0] for r in rows})
    print(character, "clips", len(names), "syllables", len(rows), "whole clips", whole, "kinds", len(kinds), kinds, flush=True)


if __name__ == "__main__":
    chars = sys.argv[1:] or [k for k in json.load(open(os.path.join(PACKS, "index.json"))) if k != "version"]
    for c in chars:
        build(c)
