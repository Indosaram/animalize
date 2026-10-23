import { describe, expect, test } from "bun:test";
import { CLIP_READ_ERROR, CLIP_TOO_LARGE_ERROR, VoiceClipError, VoiceEngine } from "./engine";

describe("VoiceEngine without AudioContext", () => {
  test("handleKey counts plays when enabled", () => {
    const engine = new VoiceEngine({ assetBase: "" });
    const before = globalThis.__animalizePlays ?? 0;
    engine.handleKey("a");
    engine.handleKey("Enter");
    engine.handleKey("1");
    expect(engine.playCount).toBe(3);
    expect(globalThis.__animalizePlays).toBe(before + 3);
  });

  test("handleKey does nothing when disabled", () => {
    const engine = new VoiceEngine({ assetBase: "" });
    engine.setSettings({ enabled: false });
    const before = globalThis.__animalizePlays ?? 0;
    engine.handleKey("a");
    engine.handleKey("Space");
    expect(engine.playCount).toBe(0);
    expect(globalThis.__animalizePlays).toBe(before);
  });

  test("mode rules follow the legacy engine", () => {
    const voice = new VoiceEngine({ assetBase: "" });
    voice.setSettings({ mode: "voice" });
    voice.handleKey("Enter");
    voice.handleKey("?");
    voice.handleKey("b");
    expect(voice.playCount).toBe(1);

    const sfx = new VoiceEngine({ assetBase: "" });
    sfx.setSettings({ mode: "sfx" });
    sfx.handleKey("b");
    sfx.handleKey("7");
    sfx.handleKey("Enter");
    expect(sfx.playCount).toBe(1);
  });

  test("setSettings merges custom partially", () => {
    const engine = new VoiceEngine({ assetBase: "" });
    engine.setSettings({ custom: { ...engine.getSettings().custom, pitch: 3 } });
    expect(engine.getSettings().custom.pitch).toBe(3);
    expect(engine.getSettings().custom.baseCharacterId).toBe("female-1");
  });
});

describe("VoiceEngine.loadClip", () => {
  const rejectingCtx = () =>
    ({
      state: "running",
      decodeAudioData: () => Promise.reject(new DOMException("Unable to decode audio data", "EncodingError")),
    }) as unknown as AudioContext;

  test("rejects a non-audio buffer with the Korean message", async () => {
    const engine = new VoiceEngine({ assetBase: "", audioContext: rejectingCtx });
    const data = new TextEncoder().encode("not audio at all").buffer as ArrayBuffer;
    const err = await engine.loadClip(data, "note.txt").catch((e) => e);
    expect(err).toBeInstanceOf(VoiceClipError);
    expect(err.message).toBe(CLIP_READ_ERROR);
    expect(err.message).toBe("소리 파일을 읽을 수 없어요. mp3, wav, m4a 파일을 골라 주세요.");
  });

  test("rejects files over 2MB", async () => {
    const engine = new VoiceEngine({ assetBase: "", audioContext: rejectingCtx });
    const err = await engine.loadClip(new ArrayBuffer(2 * 1024 * 1024 + 1), "big.mp3").catch((e) => e);
    expect(err).toBeInstanceOf(VoiceClipError);
    expect(err.message).toBe(CLIP_TOO_LARGE_ERROR);
  });

  test("returns a data URL when decoding succeeds", async () => {
    const ctx = {
      state: "running",
      decodeAudioData: () => Promise.resolve({ duration: 0.5 } as AudioBuffer),
    } as unknown as AudioContext;
    const engine = new VoiceEngine({ assetBase: "", audioContext: () => ctx });
    const res = await engine.loadClip(new Uint8Array([1, 2, 3]).buffer as ArrayBuffer, "hi.wav");
    expect(res).toEqual({ name: "hi.wav", dataUrl: "data:audio/wav;base64,AQID" });
  });
});
