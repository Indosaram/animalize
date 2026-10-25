# -*- coding: utf-8 -*-
"""Generate Animal Crossing-style syllables in each character's voice with VoxCPM2 (runs on the Windows GPU box).

input:  <job>/refs/<character>.wav (+ <character>.txt transcript), <job>/syllables.json {letter: text}
output: <job>/out/<character>/<letter>_<take>.wav
"""

import json
import os
import sys
import time

os.environ["HF_HUB_OFFLINE"] = "1"
torch_lib = r"C:\Users\sook\tts-worker\.venv\Lib\site-packages\torch\lib"
if hasattr(os, "add_dll_directory"):
    os.add_dll_directory(torch_lib)
os.environ["PATH"] = torch_lib + os.pathsep + os.environ["PATH"]

import soundfile as sf
from voxcpm import VoxCPM

JOB = sys.argv[1]
TAKES = int(sys.argv[2]) if len(sys.argv) > 2 else 3
log = open(os.path.join(JOB, "run.log"), "a", encoding="utf-8", buffering=1)
sys.stdout = log
sys.stderr = log
print("START", time.strftime("%H:%M:%S"), flush=True)

syllables = json.load(open(os.path.join(JOB, "syllables.json"), encoding="utf-8"))
model = VoxCPM.from_pretrained("openbmb/VoxCPM2", load_denoiser=False, device="cuda")
print("MODEL_READY", flush=True)

for ref in sorted(f for f in os.listdir(os.path.join(JOB, "refs")) if f.endswith(".wav")):
    character = ref[:-4]
    ref_wav = os.path.join(JOB, "refs", ref)
    ref_txt = os.path.join(JOB, "refs", character + ".txt")
    prompt_text = open(ref_txt, encoding="utf-8").read().strip() if os.path.exists(ref_txt) else None
    out = os.path.join(JOB, "out", character)
    os.makedirs(out, exist_ok=True)
    t0 = time.time()
    for letter, text in syllables.items():
        for take in range(TAKES):
            path = os.path.join(out, f"{letter}_{take}.wav")
            if os.path.exists(path):
                continue
            kwargs = dict(text=text, reference_wav_path=ref_wav, cfg_value=2.0, inference_timesteps=10,
                          max_len=200, normalize=False, denoise=False)
            if prompt_text:
                kwargs.update(prompt_wav_path=ref_wav, prompt_text=prompt_text)
            wav = model.generate(**kwargs)
            sf.write(path, wav, 48000)
    print(f"DONE {character} {time.time() - t0:.1f}s", flush=True)
print("ALL_DONE", flush=True)
