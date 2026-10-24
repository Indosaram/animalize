"""Build Animal Crossing-style letter blips cut straight from each character's real voice.

Animalese never says words: each key plays a quick blip. Every blip here is an untouched slice of
the character's own verified lines (.omo/syllables/<character>/bank.*, made by
build-syllable-banks.py from public/local-packs): no pitch shift, no time stretch, no resynthesis,
only a short fade so slices do not click. Letters pick slices whose sound is closest to the letter.
Output: public/banks/<character>/blips.m4a + blips.json, and a per-character check that every
blip still matches its source slice.

usage: python3 scripts/build-blip-banks.py [character ...]
"""

import json
import os
import subprocess
import sys

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SYLLABLES = os.path.join(ROOT, ".omo", "syllables")
BANKS = os.path.join(ROOT, "public", "banks")
SR = 44100
MAX_BLIP = 0.16
MIN_BLIP = 0.05
FADE = 0.006
GAP = 0.03
LETTERS = "abcdefghijklmnopqrstuvwxyz"
LETTER_SOUND = {
    "a": ("", "a"), "b": ("b", "i"), "c": ("s", "i"), "d": ("d", "i"), "e": ("", "i"), "f": ("h", "u"),
    "g": ("j", "i"), "h": ("", "e"), "i": ("", "a"), "j": ("j", "e"), "k": ("k", "e"), "l": ("r", "u"),
    "m": ("m", "u"), "n": ("n", "u"), "o": ("", "o"), "p": ("p", "i"), "q": ("k", "u"), "r": ("r", "a"),
    "s": ("s", "u"), "t": ("t", "i"), "u": ("y", "u"), "v": ("b", "i"), "w": ("d", "a"), "x": ("k", "u"),
    "y": ("", "a"), "z": ("s", "e"),
}
ONSET_ALIAS = {"sh": "s", "z": "s", "ch": "t", "ts": "t", "g": "k", "p": "b", "f": "h", "w": "", "y": ""}


def load(path):
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "s16le", "-"],
        capture_output=True,
        check=True,
    ).stdout
    return np.frombuffer(raw, dtype=np.int16).astype(np.float64) / 32768


def onset_vowel(romaji):
    vowel = romaji[-1] if romaji[-1] in "aiueo" else "a"
    onset = romaji.rstrip("aiueo")
    return ONSET_ALIAS.get(onset, onset), vowel


def loudest_window(seg):
    n = int(MAX_BLIP * SR)
    if len(seg) <= n:
        return 0, len(seg)
    energy = np.convolve(seg**2, np.ones(n), "valid")
    start = int(np.argmax(energy))
    return start, start + n


def shape(y):
    y = y.copy()
    f = min(len(y) // 4, int(FADE * SR))
    y[:f] *= np.linspace(0, 1, f)
    y[-f:] *= np.linspace(1, 0, f)
    return y


def build(character):
    src = os.path.join(SYLLABLES, character)
    bank = json.load(open(os.path.join(src, "bank.json")))
    source = load(os.path.join(src, bank["sprite"]))
    slices = []
    for romaji, start, end in bank["syllables"]:
        seg = source[int(start * SR) : int(end * SR)]
        if len(seg) < int(MIN_BLIP * SR):
            continue
        a, b = loudest_window(seg)
        slices.append((romaji, seg[a:b]))
    peak = max(float(np.abs(s).max()) for _, s in slices)

    used = {}
    parts, letters, refs, t = [], {}, {}, 0.0
    gap = np.zeros(int(GAP * SR))
    for letter in LETTERS:
        onset, vowel = LETTER_SOUND[letter]
        ranked = sorted(
            range(len(slices)),
            key=lambda i: (
                onset_vowel(slices[i][0]) != (onset, vowel),
                onset_vowel(slices[i][0])[1] != vowel,
                used.get(i, 0),
                -float(np.abs(slices[i][1]).max()),
            ),
        )
        i = ranked[0]
        used[i] = used.get(i, 0) + 1
        y = shape(slices[i][1]) * (0.8 / peak)
        letters[letter] = [round(t, 4), round(t + len(y) / SR, 4)]
        refs[letter] = y
        parts.extend([y, gap])
        t += (len(y) + len(gap)) / SR

    folder = os.path.join(BANKS, character)
    os.makedirs(folder, exist_ok=True)
    sprite = os.path.join(folder, "blips.m4a")
    pcm = (np.concatenate(parts) * 32767).astype(np.int16).tobytes()
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-f", "s16le", "-ar", str(SR), "-ac", "1", "-i", "-",
         "-c:a", "aac", "-b:a", "128k", sprite],
        input=pcm,
        check=True,
    )
    json.dump({"sprite": "blips.m4a", "letters": letters}, open(os.path.join(folder, "blips.json"), "w"))

    decoded = load(sprite)
    window = int(0.03 * SR)
    worst = 1.0
    for letter, (s0, _) in letters.items():
        ref = refs[letter]
        base = int(s0 * SR)
        best = -1.0
        lo = max(0, base - window)
        region = decoded[lo : base + window + len(ref)]
        if len(region) >= len(ref):
            num = np.correlate(region, ref, "valid")
            energy = np.sqrt(np.convolve(region**2, np.ones(len(ref)), "valid") * float((ref**2).sum()))
            best = float((num / np.maximum(energy, 1e-12)).max())
        worst = min(worst, best)
    distinct = len(used)
    print(character, "letters", len(letters), "distinct slices", distinct, "min_corr_vs_source", round(worst, 3), flush=True)


if __name__ == "__main__":
    for c in sys.argv[1:] or sorted(os.listdir(SYLLABLES)):
        if os.path.isdir(os.path.join(SYLLABLES, c)):
            build(c)
