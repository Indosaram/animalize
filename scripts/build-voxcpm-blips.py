"""Turn VoxCPM2-generated kana rows into per-letter Animal Crossing blips (one blip per typed letter).

input:  <gen>/<character>/<row>_<take>.wav  (VoxCPM2 output for rows like "かきくけこ。")
output: public/banks/<character>/blips.m4a + blips.json {sprite, letters: {a: [start, end], ...}}

For each row take, whisper (word timestamps) transcribes it; takes whose kana match the row are kept and
each kana is cut at its timestamp. Every letter then gets the best-matching kana across takes.
usage: python3 scripts/build-voxcpm-blips.py <gen-dir> [character ...]
"""

import glob
import json
import os
import subprocess
import sys
import tempfile

import numpy as np
import soundfile as sf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BANKS = os.path.join(ROOT, "public", "banks")
WHISPER = "/opt/homebrew/bin/whisper-cli"
MODEL = os.path.expanduser("~/.local/share/whisper/ggml-large-v3-turbo.bin")
SR = 44100
BLIP = 0.11
GAP = 0.03
ROWS = {
    "a": "あいうえお", "k": "かきくけこ", "s": "さしすせそ", "t": "たちつてと", "n": "なにぬねの",
    "h": "はひふへほ", "m": "まみむめも", "r": "らりるれろ", "b": "ばびぶべぼ", "y": "やゆよわん",
}
LETTER_KANA = {
    "a": "あ", "b": "び", "c": "し", "d": "て", "e": "い", "f": "ふ", "g": "き", "h": "へ", "i": "あ",
    "j": "ちぇ", "k": "け", "l": "る", "m": "む", "n": "ぬ", "o": "お", "p": "ぴ", "q": "く", "r": "ら",
    "s": "す", "t": "ち", "u": "う", "v": "ば", "w": "わ", "x": "く", "y": "や", "z": "ぜ",
}
FALLBACK = {
    "あ": ["か", "さ", "な", "ま", "や", "ら", "わ", "た", "ば"],
    "い": ["き", "し", "に", "み", "り", "ち", "び"],
    "う": ["く", "す", "ぬ", "む", "ゆ", "る", "つ", "ぶ", "ふ"],
    "お": ["こ", "そ", "の", "も", "よ", "ろ", "と", "ぼ", "ほ"],
    "へ": ["け", "せ", "て", "ね", "め", "れ", "べ"],
    "ふ": ["ぶ", "す", "く", "う"],
    "ちぇ": ["ち", "て", "せ"],
    "ぴ": ["び", "ひ", "き"],
    "ぜ": ["せ", "す"],
    "し": ["ち", "き"],
    "す": ["つ", "く"],
    "ら": ["な", "わ"],
    "る": ["ぬ", "む"],
    "ば": ["わ", "ま"],
    "び": ["み", "に"],
    "け": ["て", "せ"],
    "き": ["ち", "し"],
    "く": ["つ", "す"],
    "ぬ": ["む", "る"],
    "む": ["ぬ", "ぶ"],
    "わ": ["や", "ば"],
    "や": ["わ", "あ"],
    "て": ["け", "せ"],
    "ち": ["し", "き"],
}


def to_hiragana(text):
    return "".join(chr(ord(c) - 0x60) if "ァ" <= c <= "ヶ" else c for c in text)


def load(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "s16le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.int16).astype(np.float64) / 32768


def kana_times(path):
    with tempfile.TemporaryDirectory() as tmp:
        wav = os.path.join(tmp, "in.wav")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", path, "-ar", "16000", "-ac", "1", wav], check=True)
        subprocess.run([WHISPER, "-m", MODEL, "-l", "ja", "-ml", "1", "-sow", "-oj", "-of", os.path.join(tmp, "o"), "-np", "-f", wav],
                       capture_output=True, check=True)
        data = json.load(open(os.path.join(tmp, "o.json"), encoding="utf-8"))
    out = []
    for seg in data.get("transcription", []):
        text = to_hiragana(seg["text"].strip())
        start, end = seg["offsets"]["from"] / 1000, seg["offsets"]["to"] / 1000
        kana = [c for c in text if "ぁ" <= c <= "ゖ"]
        if not kana or end <= start:
            continue
        step = (end - start) / len(kana)
        for i, k in enumerate(kana):
            out.append((k, start + i * step, start + (i + 1) * step))
    return out


def onset_window(y, start, end):
    a, b = int(max(0, start - 0.03) * SR), int(min(len(y) / SR, end + 0.05) * SR)
    seg = y[a:b]
    if len(seg) < int(0.05 * SR):
        return None
    env = np.convolve(np.abs(seg), np.ones(int(0.005 * SR)) / int(0.005 * SR), "same")
    on = np.where(env > 0.15 * env.max())[0]
    if not len(on):
        return None
    s = max(0, on[0] - int(0.008 * SR))
    clip = seg[s : s + int(BLIP * SR)].copy()
    if len(clip) < int(0.06 * SR) or np.abs(clip).max() < 0.02:
        return None
    fade = int(0.004 * SR)
    clip[:fade] *= np.linspace(0, 1, fade)
    tail = int(0.03 * SR)
    clip[-tail:] *= np.linspace(1, 0, tail) ** 2
    return clip


def collect(gen, character):
    found = {}
    for path in sorted(glob.glob(os.path.join(gen, character, "*.wav"))):
        row = os.path.basename(path).split("_")[0]
        expected = ROWS.get(row)
        if not expected:
            continue
        times = kana_times(path)
        heard = "".join(k for k, _, _ in times)
        hits = sum(1 for k in expected if k in heard)
        if hits < 3:
            continue
        y = load(path)
        for k, s, e in times:
            if k in expected:
                clip = onset_window(y, s, e)
                if clip is not None:
                    found.setdefault(k, []).append(clip)
    return found


def pick(found, kana):
    for k in [kana] + [kana[0]] + FALLBACK.get(kana, []):
        if found.get(k):
            clips = found[k]
            return max(clips, key=lambda c: float(np.sqrt((c**2).mean()))), k
    return None, None


def build(gen, character):
    found = collect(gen, character)
    parts, letters, t, sources = [], {}, 0.0, {}
    gap = np.zeros(int(GAP * SR))
    missing = []
    for letter, kana in LETTER_KANA.items():
        clip, used = pick(found, kana)
        if clip is None:
            missing.append(letter)
            continue
        clip = clip * (0.8 / max(1e-6, float(np.abs(clip).max())))
        letters[letter] = [round(t, 4), round(t + len(clip) / SR, 4)]
        sources[letter] = used
        parts.extend([clip, gap])
        t += (len(clip) + len(gap)) / SR
    if missing:
        raise SystemExit(f"{character}: no usable syllable for letters {''.join(missing)}")
    folder = os.path.join(BANKS, character)
    os.makedirs(folder, exist_ok=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "s16le", "-ar", str(SR), "-ac", "1", "-i", "-",
                    "-c:a", "aac", "-b:a", "128k", os.path.join(folder, "blips.m4a")],
                   input=(np.concatenate(parts) * 32767).astype(np.int16).tobytes(), check=True)
    json.dump({"sprite": "blips.m4a", "letters": letters}, open(os.path.join(folder, "blips.json"), "w"))
    kinds = sorted(found)
    print(character, "kana found", len(kinds), "".join(kinds), "| letters", len(letters),
          "|", " ".join(f"{l}={sources[l]}" for l in sorted(sources)), flush=True)


if __name__ == "__main__":
    gen = sys.argv[1]
    for c in sys.argv[2:] or sorted(os.listdir(gen)):
        if os.path.isdir(os.path.join(gen, c)):
            build(gen, c)
