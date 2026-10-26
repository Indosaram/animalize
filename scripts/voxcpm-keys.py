# -*- coding: utf-8 -*-
"""Synthesize one short sound per key in each character's voice with VoxCPM2 (runs on the Windows GPU box).

input:  <job>/refs/<character>.wav + <character>.txt (transcript of the reference), <job>/keys.json {key: text} (scripts/voxcpm-keys.json)
output: <job>/out/<character>/<key>_<take>.wav, progress in <job>/run.log
usage:  python voxcpm-keys.py <job> [takes]
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

keys = json.load(open(os.path.join(JOB, "keys.json"), encoding="utf-8"))
lora = os.path.join(JOB, "lora")
lora_config = None
if os.path.isdir(lora):
    from voxcpm.model.voxcpm2 import LoRAConfig

    lora_config = LoRAConfig(**json.load(open(os.path.join(lora, "lora_config.json"), encoding="utf-8"))["lora_config"])
model = VoxCPM.from_pretrained("openbmb/VoxCPM2", load_denoiser=False, device="cuda",
                               lora_config=lora_config, lora_weights_path=lora if lora_config else None)
print("MODEL_READY", flush=True)

for ref in sorted(f for f in os.listdir(os.path.join(JOB, "refs")) if f.endswith(".wav")):
    character = ref[:-4]
    ref_wav = os.path.join(JOB, "refs", ref)
    prompt_text = open(os.path.join(JOB, "refs", character + ".txt"), encoding="utf-8").read().strip()
    out = os.path.join(JOB, "out", character)
    os.makedirs(out, exist_ok=True)
    own_keys = os.path.join(JOB, "refs", character + ".keys.json")
    char_keys = json.load(open(own_keys, encoding="utf-8")) if os.path.exists(own_keys) else keys
    t0 = time.time()
    for key, text in char_keys.items():
        for take in range(TAKES):
            path = os.path.join(out, f"{key}_{take}.wav")
            if os.path.exists(path):
                continue
            wav = model.generate(text=text, prompt_wav_path=ref_wav, prompt_text=prompt_text, reference_wav_path=ref_wav,
                                 cfg_value=2.0, inference_timesteps=10, max_len=120, normalize=False, denoise=False)
            sf.write(path, wav, 48000)
    print(f"DONE {character} {time.time() - t0:.1f}s", flush=True)
print("ALL_DONE", flush=True)
