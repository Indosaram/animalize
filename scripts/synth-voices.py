"""Synthesize Animal Crossing-style letter blips for each character from scratch.

No recording is used: every blip is a tiny synthetic "voice" built from a harmonic source shaped by
vowel formants, with a short consonant noise in front, the way Animalese turns each letter into a
quick pitched syllable. Characters differ only by the voice parameters in VOICES below.
Output: public/banks/<character>/blips.m4a + blips.json {sprite, letters: {a: [start, end], ...}}.

usage: python3 scripts/synth-voices.py [character ...]
"""

import json
import os
import subprocess
import sys

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BANKS = os.path.join(ROOT, "public", "banks")
SR = 44100
GAP = 0.03

FORMANTS = {
    "a": [(800, 90), (1200, 110), (2600, 160)],
    "i": [(300, 60), (2300, 120), (3000, 180)],
    "u": [(330, 60), (1000, 100), (2300, 160)],
    "e": [(500, 70), (1900, 110), (2600, 160)],
    "o": [(550, 80), (850, 90), (2500, 160)],
}
VOWEL_PITCH = {"a": 0.0, "i": 2.0, "u": -1.0, "e": 1.0, "o": -2.0}
LETTER_SOUND = {
    "a": ("", "a"), "b": ("b", "i"), "c": ("s", "i"), "d": ("d", "i"), "e": ("", "i"), "f": ("h", "u"),
    "g": ("k", "i"), "h": ("h", "e"), "i": ("", "a"), "j": ("s", "e"), "k": ("k", "e"), "l": ("r", "u"),
    "m": ("m", "u"), "n": ("n", "u"), "o": ("", "o"), "p": ("b", "i"), "q": ("k", "u"), "r": ("r", "a"),
    "s": ("s", "u"), "t": ("t", "i"), "u": ("", "u"), "v": ("b", "i"), "w": ("", "a"), "x": ("k", "u"),
    "y": ("", "a"), "z": ("s", "e"),
}
LETTER_STEP = {l: ((i * 5) % 7 - 3) * 0.5 for i, l in enumerate("abcdefghijklmnopqrstuvwxyz")}

VOICES = {
    "chiikawa": dict(f0=390, formant=1.45, length=0.095, glide=1.5, breath=0.22, rasp=0.0, tilt=1.6, vibrato=0.25),
    "hachiware": dict(f0=470, formant=1.35, length=0.08, glide=0.6, breath=0.06, rasp=0.0, tilt=1.1, vibrato=0.0),
    "usagi": dict(f0=560, formant=1.4, length=0.08, glide=3.0, breath=0.05, rasp=0.45, tilt=0.8, vibrato=0.0),
    "momonga": dict(f0=620, formant=1.55, length=0.085, glide=-1.2, breath=0.1, rasp=0.0, tilt=1.2, vibrato=0.4),
    "shisa": dict(f0=440, formant=1.3, length=0.08, glide=1.0, breath=0.08, rasp=0.0, tilt=1.0, vibrato=0.0),
    "kurimanju": dict(f0=140, formant=1.0, length=0.13, glide=-2.0, breath=0.35, rasp=0.1, tilt=1.4, vibrato=0.0),
}


def envelope(freqs, vowel, scale):
    gain = np.zeros_like(freqs)
    for i, (fc, bw) in enumerate(FORMANTS[vowel]):
        fc, bw = fc * scale, bw * scale
        gain += (1.0 / (1 + ((freqs - fc) / (bw / 2)) ** 2)) * (1.0, 0.7, 0.35)[i]
    return gain


def voiced(vowel, v, step, rng):
    n = int(v["length"] * SR)
    t = np.arange(n) / SR
    semis = VOWEL_PITCH[vowel] + step + v["glide"] * (t / t[-1])
    if v["rasp"]:
        semis = semis + v["rasp"] * 1.5 * np.sin(2 * np.pi * 35 * t)
    f0 = v["f0"] * 2 ** (semis / 12) * (1 + 0.012 * v["vibrato"] * np.sin(2 * np.pi * 9 * t))
    phase = 2 * np.pi * np.cumsum(f0) / SR
    out = np.zeros(n)
    for k in range(1, int(9000 / v["f0"]) + 1):
        fk = f0 * k
        amp = envelope(fk, vowel, v["formant"]) / k ** (v["tilt"] * 0.5)
        amp[fk > SR / 2 - 500] = 0
        out += amp * np.sin(k * phase)
    noise = rng.standard_normal(n)
    spec = np.fft.rfft(noise)
    spec *= envelope(np.fft.rfftfreq(n, 1 / SR), vowel, v["formant"])
    breath = np.fft.irfft(spec, n)
    out = out / max(1e-9, np.abs(out).max()) + v["breath"] * breath / max(1e-9, np.abs(breath).max())
    attack, release = int(0.008 * SR), int(0.035 * SR)
    env = np.ones(n)
    env[:attack] = np.linspace(0, 1, attack) ** 1.5
    env[-release:] *= np.linspace(1, 0, release) ** 2
    return out * env


def consonant(kind, v, rng):
    if not kind:
        return np.zeros(0)
    if kind in ("m", "n"):
        n = int(0.022 * SR)
        t = np.arange(n) / SR
        hum = np.sin(2 * np.pi * v["f0"] * t) + 0.3 * np.sin(4 * np.pi * v["f0"] * t)
        return hum * np.linspace(0.2, 0.5, n)
    if kind == "r":
        n = int(0.012 * SR)
        return np.sin(2 * np.pi * v["f0"] * np.arange(n) / SR) * np.hanning(n) * 0.4
    band = {"s": (4500, 9000, 0.05), "h": (800, 4000, 0.035), "k": (1500, 4000, 0.018),
            "t": (3000, 7000, 0.014), "d": (2500, 6000, 0.012), "b": (300, 1500, 0.012)}[kind]
    lo, hi, length = band[0] * min(v["formant"], 1.3), band[1], band[2]
    n = int(length * SR)
    spec = np.fft.rfft(rng.standard_normal(n))
    f = np.fft.rfftfreq(n, 1 / SR)
    spec[(f < lo) | (f > hi)] = 0
    burst = np.fft.irfft(spec, n)
    burst /= max(1e-9, np.abs(burst).max())
    shape = np.linspace(1, 0.2, n) if kind in "kbtd" else np.hanning(n)
    return burst * shape * (0.35 if kind in "sh" else 0.5)


def blip(letter, v, rng):
    kind, vowel = LETTER_SOUND[letter]
    y = np.concatenate([consonant(kind, v, rng), voiced(vowel, v, LETTER_STEP[letter], rng)])
    fade = int(0.003 * SR)
    y[:fade] *= np.linspace(0, 1, fade)
    y[-fade:] *= np.linspace(1, 0, fade)
    return y


def build(character):
    v = VOICES[character]
    rng = np.random.default_rng(sum(map(ord, character)))
    gap = np.zeros(int(GAP * SR))
    parts, letters, t = [], {}, 0.0
    blips = {l: blip(l, v, rng) for l in "abcdefghijklmnopqrstuvwxyz"}
    peak = max(float(np.abs(y).max()) for y in blips.values())
    for letter, y in blips.items():
        y = y * (0.8 / peak)
        letters[letter] = [round(t, 4), round(t + len(y) / SR, 4)]
        parts.extend([y, gap])
        t += (len(y) + len(gap)) / SR
    folder = os.path.join(BANKS, character)
    os.makedirs(folder, exist_ok=True)
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-f", "s16le", "-ar", str(SR), "-ac", "1", "-i", "-",
         "-c:a", "aac", "-b:a", "128k", os.path.join(folder, "blips.m4a")],
        input=(np.concatenate(parts) * 32767).astype(np.int16).tobytes(),
        check=True,
    )
    json.dump({"sprite": "blips.m4a", "letters": letters}, open(os.path.join(folder, "blips.json"), "w"))
    print(character, "letters", len(letters), "length ms", round(np.mean([b - a for a, b in letters.values()]) * 1000), flush=True)


if __name__ == "__main__":
    for c in sys.argv[1:] or VOICES:
        build(c)
