"""Synthesize Animal Crossing-style letter blips for each character from scratch, tuned to measurements.

No recording is used in the output. Each blip is a harmonic voice plus breath noise; its pitch, pitch
spread, timbre (spectral envelope), breathiness and length come from scripts/voice-profile.json,
which scripts/measure-voices.py measured from the character's real lines. Vowel formants add only
the a/i/u/e/o contrast on top of the character's own timbre.
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
PROFILE = json.load(open(os.path.join(ROOT, "scripts", "voice-profile.json")))
BANDS = np.geomspace(150, 7000, 48)
SR = 44100
GAP = 0.03
LETTERS = "abcdefghijklmnopqrstuvwxyz"

VOWEL_FORMANTS = {
    "a": [(800, 1.0), (1250, 0.8)],
    "i": [(330, 1.0), (2400, 0.8)],
    "u": [(360, 1.0), (1150, 0.6)],
    "e": [(520, 1.0), (1950, 0.8)],
    "o": [(560, 1.0), (900, 0.8)],
}
LETTER_SOUND = {
    "a": ("", "a"), "b": ("b", "i"), "c": ("s", "i"), "d": ("d", "i"), "e": ("", "i"), "f": ("h", "u"),
    "g": ("k", "i"), "h": ("h", "e"), "i": ("", "a"), "j": ("s", "e"), "k": ("k", "e"), "l": ("r", "u"),
    "m": ("m", "u"), "n": ("n", "u"), "o": ("", "o"), "p": ("b", "i"), "q": ("k", "u"), "r": ("r", "a"),
    "s": ("s", "u"), "t": ("t", "i"), "u": ("", "u"), "v": ("b", "i"), "w": ("", "a"), "x": ("k", "u"),
    "y": ("", "a"), "z": ("s", "e"),
}
LETTER_RANK = {l: ((i * 11) % 26) / 25 for i, l in enumerate(LETTERS)}


def timbre(profile, freqs):
    db = np.interp(np.log(np.maximum(freqs, 1)), np.log(BANDS), profile["envelope_db"])
    return 10 ** (db / 20)


def vowel(freqs, name, scale):
    gain = np.full_like(freqs, 0.25)
    for fc, amp in VOWEL_FORMANTS[name]:
        fc *= scale
        gain += amp / (1 + ((freqs - fc) / (fc * 0.18)) ** 2)
    return gain


def voiced(name, profile, letter, rng):
    n = int(profile["blip_seconds"] * SR)
    t = np.arange(n) / SR
    spread = profile["range_semitones"] * profile["spread_ratio"]
    step = (LETTER_RANK[letter] - 0.5) * spread
    semis = step + profile["glide_semitones"] * (0.5 - t / t[-1])
    f0 = profile["f0_median"] * 2 ** (semis / 12)
    phase = 2 * np.pi * np.cumsum(f0) / SR
    scale = profile["vowel_scale"]
    out = np.zeros(n)
    for k in range(1, int(7500 / profile["f0_median"]) + 1):
        fk = f0 * k
        amp = timbre(profile, fk) * vowel(fk, name, scale)
        amp[fk > 7500] = 0
        out += amp * np.sin(k * phase + rng.uniform(0, 2 * np.pi))
    spec = np.fft.rfft(rng.standard_normal(n))
    freqs = np.fft.rfftfreq(n, 1 / SR)
    spec *= timbre(profile, freqs) * vowel(freqs, name, scale) * (freqs < 7500)
    breath = np.fft.irfft(spec, n)
    out /= max(1e-9, np.sqrt((out**2).mean()))
    breath /= max(1e-9, np.sqrt((breath**2).mean()))
    mix = out + profile["breath"] * breath
    attack, release = int(0.006 * SR), int(min(0.03, profile["blip_seconds"] * 0.35) * SR)
    env = np.ones(n)
    env[:attack] = np.linspace(0, 1, attack) ** 1.5
    env[-release:] *= np.linspace(1, 0, release) ** 2
    return mix * env


def consonant(kind, profile, rng):
    if not kind:
        return np.zeros(0)
    f0 = profile["f0_median"]
    if kind in ("m", "n", "r"):
        n = int((0.012 if kind == "r" else 0.02) * SR)
        t = np.arange(n) / SR
        hum = np.sin(2 * np.pi * f0 * t) + 0.3 * np.sin(4 * np.pi * f0 * t)
        return hum * np.hanning(n) * 0.5
    lo, hi, length = {"s": (4000, 7500, 0.04), "h": (900, 4000, 0.03), "k": (1500, 4000, 0.016),
                      "t": (3000, 7000, 0.012), "d": (2500, 6000, 0.01), "b": (300, 1500, 0.01)}[kind]
    n = int(length * SR)
    spec = np.fft.rfft(rng.standard_normal(n))
    f = np.fft.rfftfreq(n, 1 / SR)
    spec[(f < lo) | (f > hi)] = 0
    burst = np.fft.irfft(spec, n)
    burst /= max(1e-9, np.abs(burst).max())
    shape = np.linspace(1, 0.2, n) if kind in "kbtd" else np.hanning(n)
    return burst * shape * (0.3 if kind in "sh" else 0.45)


def blip(letter, profile, rng):
    kind, name = LETTER_SOUND[letter]
    y = voiced(name, profile, letter, rng)
    y /= max(1e-9, np.abs(y).max())
    y = np.concatenate([consonant(kind, profile, rng), y])
    fade = int(0.003 * SR)
    y[:fade] *= np.linspace(0, 1, fade)
    y[-fade:] *= np.linspace(1, 0, fade)
    return y


def build(character, out_root=BANKS):
    profile = PROFILE[character]
    rng = np.random.default_rng(sum(map(ord, character)))
    gap = np.zeros(int(GAP * SR))
    parts, letters, t = [], {}, 0.0
    for letter in LETTERS:
        y = blip(letter, profile, rng) * 0.8
        letters[letter] = [round(t, 4), round(t + len(y) / SR, 4)]
        parts.extend([y, gap])
        t += (len(y) + len(gap)) / SR
    folder = os.path.join(out_root, character)
    os.makedirs(folder, exist_ok=True)
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-f", "s16le", "-ar", str(SR), "-ac", "1", "-i", "-",
         "-c:a", "aac", "-b:a", "128k", os.path.join(folder, "blips.m4a")],
        input=(np.concatenate(parts) * 32767).astype(np.int16).tobytes(),
        check=True,
    )
    json.dump({"sprite": "blips.m4a", "letters": letters}, open(os.path.join(folder, "blips.json"), "w"))
    print(character, "letters", len(letters), "blip ms", round(profile["blip_seconds"] * 1000), flush=True)


if __name__ == "__main__":
    for c in sys.argv[1:] or PROFILE:
        build(c)
