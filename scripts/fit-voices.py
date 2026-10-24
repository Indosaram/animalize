"""Fit the synthesizer to each character's measured voice and report synthetic-vs-real numbers.

Reads the measured fields in scripts/voice-profile.json (from measure-voices.py), sets the synth
parameters from them, picks the breath level whose synthetic aperiodicity is closest to the real
one, writes the parameters back, renders the final blips and prints a comparison table.

usage: python3 scripts/fit-voices.py
"""

import importlib.util
import json
import os
import tempfile

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROFILE_PATH = os.path.join(ROOT, "scripts", "voice-profile.json")


def load_module(name):
    spec = importlib.util.spec_from_file_location(name.replace("-", "_"), os.path.join(ROOT, "scripts", name + ".py"))
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def render_and_measure(synth, measure, character, tmp):
    synth.build(character, tmp)
    wav = os.path.join(tmp, character + ".wav")
    import subprocess

    import pyworld as pw

    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", os.path.join(tmp, character, "blips.m4a"), wav], check=True)
    got = measure.measure([wav])
    y = measure.load(wav)
    f0, t = pw.harvest(y, measure.SR, f0_floor=80, f0_ceil=1100, frame_period=5)
    letters = json.load(open(os.path.join(tmp, character, "blips.json")))["letters"]
    got["voiced_letters"] = sum(
        int(((f0 > 0) & (t > a) & (t < b)).sum() >= 3) for a, b in letters.values()
    )
    return got


def envelope_error(a, b):
    a, b = np.array(a), np.array(b)
    return float(np.sqrt(((a - b) ** 2).mean()))


def main():
    profile = json.load(open(PROFILE_PATH))
    measure = load_module("measure-voices")
    for character, real in profile.items():
        real["blip_seconds"] = round(float(np.clip(1 / real["syllables_per_second"], 0.065, 0.12)), 3)
        real["spread_ratio"] = 1.0
        real["glide_semitones"] = 1.0
        real["vowel_scale"] = 1.2
        real.setdefault("breath", 0.3)
    json.dump(profile, open(PROFILE_PATH, "w"), indent=2)

    rows = []
    with tempfile.TemporaryDirectory() as tmp:
        for character, real in profile.items():
            best = None
            for breath in (0.0, 0.15, 0.3, 0.5, 0.75, 1.0):
                real["breath"] = breath
                json.dump(profile, open(PROFILE_PATH, "w"), indent=2)
                synth = load_module("synth-voices")
                try:
                    got = render_and_measure(synth, measure, character, tmp)
                except ValueError as err:
                    print(character, "breath", breath, "skipped:", err, flush=True)
                    continue
                miss = abs(got["aperiodicity"] - real["aperiodicity"])
                if got["voiced_letters"] < 25:
                    continue
                if best is None or miss < best[0]:
                    best = (miss, breath, got)
            real["breath"] = best[1]
            json.dump(profile, open(PROFILE_PATH, "w"), indent=2)
            got = best[2]
            rows.append((character, real, got))
    synth = load_module("synth-voices")
    for character in profile:
        synth.build(character)

    print("character | pitch real/synth Hz | range real/synth st | breath(aperiodicity) real/synth | timbre error dB | voiced letters")
    for character, real, got in rows:
        print(
            f"{character} | {real['f0_median']:.0f}/{got['f0_median']:.0f} | "
            f"{real['range_semitones']:.1f}/{got['range_semitones']:.1f} | "
            f"{real['aperiodicity']:.3f}/{got['aperiodicity']:.3f} | "
            f"{envelope_error(real['envelope_db'], got['envelope_db']):.1f} | {got['voiced_letters']}/26 (breath {real['breath']})"
        )


if __name__ == "__main__":
    main()
