# -*- coding: utf-8 -*-
"""Transcribe every generated key take with faster-whisper on the Windows GPU box, so the Mac never runs whisper.

input:  <out>/<character>/<key>_<take>.wav (voxcpm-keys.py output)
output: <out>/heard.json {character: {"<key>_<take>.wav": text}}, progress in <out>/transcribe.log
usage:  python voxcpm-transcribe.py <out> <lang> [character ...]
"""

import json
import os
import sys
import time

torch_lib = r"C:\Users\sook\tts-worker\.venv\Lib\site-packages\torch\lib"
if hasattr(os, "add_dll_directory"):
    os.add_dll_directory(torch_lib)
os.environ["PATH"] = torch_lib + os.pathsep + os.environ["PATH"]

from faster_whisper import WhisperModel

OUT, LANG = sys.argv[1], sys.argv[2]
log = open(os.path.join(OUT, "transcribe.log"), "a", encoding="utf-8", buffering=1)
sys.stdout = log
sys.stderr = log
print("START", time.strftime("%H:%M:%S"), flush=True)

model = WhisperModel("large-v3", device="cuda", compute_type="float16")
path = os.path.join(OUT, "heard.json")
heard = json.load(open(path, encoding="utf-8")) if os.path.exists(path) else {}
chars = sys.argv[3:] or sorted(d for d in os.listdir(OUT) if os.path.isdir(os.path.join(OUT, d)))
for c in chars:
    heard[c] = {}
    for f in sorted(os.listdir(os.path.join(OUT, c))):
        if f.endswith(".wav"):
            segs, _ = model.transcribe(os.path.join(OUT, c, f), language=LANG, beam_size=5, vad_filter=False)
            heard[c][f] = " ".join(s.text.strip() for s in segs)
    json.dump(heard, open(path, "w", encoding="utf-8"), ensure_ascii=False)
    print("DONE", c, len(heard[c]), flush=True)
print("ALL_DONE", flush=True)
