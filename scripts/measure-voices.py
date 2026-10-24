"""Measure each character's voice so scripts/synth-voices.py can be tuned to it.

Recordings are only measured here; nothing from them is copied into the app.
input: a folder with <character>/*.wav (vocal-separated lines). output: voice-profile.json with, per
character, pitch median / range, formant scale vs an adult reference, breathiness, syllable rate.

usage: python3 scripts/measure-voices.py <clips-dir> [out.json]
"""

import glob
import json
import os
import sys

import numpy as np
import pyworld as pw
import soundfile as sf
from scipy.signal import resample_poly

SR = 16000
BANDS = np.geomspace(150, 7000, 48)


def load(path):
    y, sr = sf.read(path, always_2d=True)
    y = y.mean(axis=1)
    return resample_poly(y, SR, sr) if sr != SR else y


def measure(paths):
    f0s, aper, rates, envs = [], [], [], []
    for path in paths:
        y = load(path)
        if len(y) < SR * 0.2:
            continue
        f0, t = pw.harvest(y, SR, f0_floor=80, f0_ceil=1100, frame_period=10)
        sp = pw.cheaptrick(y, f0, t, SR)
        ap = pw.d4c(y, f0, t, SR)
        voiced = f0 > 0
        f0s.extend(f0[voiced])
        band = (np.arange(ap.shape[1]) * SR / 2 / (ap.shape[1] - 1) > 1000) & (
            np.arange(ap.shape[1]) * SR / 2 / (ap.shape[1] - 1) < 5000
        )
        aper.extend(ap[voiced][:, band].mean(axis=1))
        if voiced.any():
            freqs = np.arange(sp.shape[1]) * SR / 2 / (sp.shape[1] - 1)
            logsp = np.log(sp[voiced] + 1e-12)
            envs.extend(np.array([np.interp(BANDS, freqs, row) for row in logsp]))
        env = np.convolve(np.abs(y), np.ones(int(0.02 * SR)) / int(0.02 * SR), "same")
        peaks = np.where((env[1:-1] > env[:-2]) & (env[1:-1] >= env[2:]) & (env[1:-1] > 0.3 * env.max()))[0]
        if len(peaks) > 1:
            keep = [peaks[0]]
            for p in peaks[1:]:
                if p - keep[-1] > int(0.08 * SR):
                    keep.append(p)
            rates.append(len(keep) / (voiced.sum() * 0.01 + 1e-6))
    f0s = np.array(f0s)
    if not len(f0s):
        raise ValueError("no voiced frames found in " + ", ".join(paths))
    center = np.median(f0s)
    f0s = f0s[(f0s > center / 1.8) & (f0s < center * 1.8)]
    env = np.median(np.array(envs), axis=0) * 10 / np.log(10)
    env -= env.max()
    return {
        "f0_median": round(float(np.median(f0s)), 1),
        "f0_p10": round(float(np.percentile(f0s, 10)), 1),
        "f0_p90": round(float(np.percentile(f0s, 90)), 1),
        "range_semitones": round(float(12 * np.log2(np.percentile(f0s, 90) / np.percentile(f0s, 10))), 2),
        "envelope_db": [round(float(v), 2) for v in env],
        "aperiodicity": round(float(np.median(aper)), 3),
        "syllables_per_second": round(float(np.median(rates)), 2) if rates else None,
        "clips": len(paths),
    }


if __name__ == "__main__":
    root = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else "voice-profile.json"
    profile = {}
    for folder in sorted(glob.glob(os.path.join(root, "*"))):
        name = os.path.basename(folder)
        profile[name] = measure(sorted(glob.glob(os.path.join(folder, "*.wav"))))
        print(name, json.dumps(profile[name]), flush=True)
    json.dump(profile, open(out, "w"), indent=2)
