import { describe, expect, test } from "bun:test";
import { createMemoryClipStore } from "./clipStore";
import { CLIP_READ_ERROR, PACK_LIMIT_ERROR, PACK_TOO_LARGE_ERROR, VoiceClipError, VoiceEngine } from "./engine";
import { mergeSettings } from "./storage";

/** Fake AudioContext: buffers starting with byte 0x52 ('R') decode, anything else is rejected. */
function fakeContext() {
  const started: { tag: number; detune: number; rate: number }[] = [];
  const stopped: number[] = [];
  const ctx = {
    state: "running",
    currentTime: 0,
    destination: {},
    resume: () => Promise.resolve(),
    decodeAudioData: (data: ArrayBuffer) => {
      const bytes = new Uint8Array(data);
      if (bytes[0] !== 0x52) return Promise.reject(new DOMException("Unable to decode audio data", "EncodingError"));
      return Promise.resolve({ duration: 0.3, tag: bytes[1] } as unknown as AudioBuffer);
    },
    createGain: () => ({ gain: { value: 1 }, connect() {} }),
    createBufferSource: () => {
      const node = {
        buffer: null as null | { tag: number },
        playbackRate: { value: 1 },
        detune: { value: 0 },
        onended: null as null | (() => void),
        connect() {},
        start() {
          started.push({ tag: node.buffer!.tag, detune: node.detune.value, rate: node.playbackRate.value });
        },
        stop() {
          stopped.push(node.buffer!.tag);
        },
      };
      return node;
    },
  };
  return { ctx: ctx as unknown as AudioContext, started, stopped };
}

const clip = (tag: number, name = `c${tag}.wav`) => ({ data: new Uint8Array([0x52, tag, 0, 0]).buffer as ArrayBuffer, name });

async function engineWithPack(tags: number[]) {
  const fake = fakeContext();
  const engine = new VoiceEngine({ assetBase: "", audioContext: () => fake.ctx, clipStore: createMemoryClipStore() });
  engine.setSettings({ characterId: "chiikawa" });
  const pack = await engine.addPackClips("chiikawa", tags.map((t) => clip(t)));
  return { engine, pack, ...fake };
}

describe("character sound packs", () => {
  test("voice keys play only clips from the selected character's pack", async () => {
    const { engine, started } = await engineWithPack([1, 2, 3]);
    for (const k of ["a", "b", "7", "ㅎ", "Z"]) engine.handleKey(k);
    await engine.settled();
    expect(started.length).toBe(5);
    for (const s of started) {
      expect([1, 2, 3]).toContain(s.tag);
      expect(Math.abs(s.detune)).toBeLessThanOrEqual(100);
      expect(s.rate).toBe(1.25);
    }
  });

  test("sfx keys keep the bundled sfx path", async () => {
    const { engine, started } = await engineWithPack([1, 2]);
    engine.handleKey("Enter");
    await engine.settled();
    // the sfx path fetches a bundled asset (fails in tests), so no pack clip is started
    expect(started.length).toBe(0);
    expect(engine.playCount).toBe(1);
  });

  test("never repeats the same clip twice in a row over 50 presses", async () => {
    const { engine, started } = await engineWithPack([1, 2, 3]);
    for (let i = 0; i < 50; i++) {
      engine.handleKey("a");
      await engine.settled();
    }
    expect(started.length).toBe(50);
    for (let i = 1; i < started.length; i++) expect(started[i].tag).not.toBe(started[i - 1].tag);
    expect(new Set(started.map((s) => s.tag)).size).toBe(3);
  });

  test("keeps at most 4 pack voices, stopping the oldest", async () => {
    const { engine, stopped } = await engineWithPack([1, 2, 3]);
    for (let i = 0; i < 6; i++) engine.handleKey("a");
    await engine.settled();
    expect(stopped.length).toBe(2);
  });

  test("rejects a non-audio file with the Korean message", async () => {
    const { engine } = await engineWithPack([1]);
    const bad = { data: new TextEncoder().encode("hello").buffer as ArrayBuffer, name: "note.txt" };
    const err = await engine.addPackClips("chiikawa", [bad]).catch((e) => e);
    expect(err).toBeInstanceOf(VoiceClipError);
    expect(err.message).toBe(CLIP_READ_ERROR);
    expect(engine.getSettings().packs.chiikawa.length).toBe(1);
  });

  test("rejects files over 1MB", async () => {
    const { engine } = await engineWithPack([1]);
    const err = await engine.addPackClips("chiikawa", [{ data: new ArrayBuffer(1024 * 1024 + 1), name: "big.wav" }]).catch((e) => e);
    expect(err.message).toBe(PACK_TOO_LARGE_ERROR);
    expect(err.message).toBe("파일이 너무 커요 (1MB 이하)");
  });

  test("rejects the 13th clip", async () => {
    const { engine } = await engineWithPack([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    const err = await engine.addPackClips("chiikawa", [clip(13)]).catch((e) => e);
    expect(err).toBeInstanceOf(VoiceClipError);
    expect(err.message).toBe(PACK_LIMIT_ERROR);
    expect(err.message).toBe("한 캐릭터에 소리는 12개까지 넣을 수 있어요");
  });

  test("keypress with a pack increments playCount and the global counter", async () => {
    const { engine } = await engineWithPack([1, 2]);
    const before = globalThis.__animalizePlays ?? 0;
    engine.handleKey("h");
    engine.handleKey("i");
    expect(engine.playCount).toBe(2);
    expect(globalThis.__animalizePlays).toBe(before + 2);
  });

  test("lazily fetches clips it has not cached (another engine added them)", async () => {
    const store = createMemoryClipStore();
    const a = fakeContext();
    const writer = new VoiceEngine({ assetBase: "", audioContext: () => a.ctx, clipStore: store });
    const pack = await writer.addPackClips("usagi", [clip(7)]);
    const b = fakeContext();
    const reader = new VoiceEngine({ assetBase: "", audioContext: () => b.ctx, clipStore: store });
    reader.setSettings({ characterId: "usagi", packs: { usagi: pack } });
    reader.handleKey("a");
    await reader.settled();
    expect(b.started.map((s) => s.tag)).toEqual([7]);
  });

  test("removePackClip empties the pack and falls back to animalese", async () => {
    const { engine, pack, started } = await engineWithPack([1]);
    await engine.removePackClip("chiikawa", pack[0].id);
    expect(engine.getSettings().packs.chiikawa).toBeUndefined();
    engine.handleKey("a");
    await engine.settled();
    expect(started.length).toBe(0);
  });

  test("previewPackClip plays the requested clip", async () => {
    const { engine, pack, started } = await engineWithPack([4, 5]);
    await engine.previewPackClip("chiikawa", pack[1].id);
    expect(started.map((s) => s.tag)).toEqual([5]);
  });
});

describe("mergeSettings packs", () => {
  test("tolerates malformed packs", () => {
    expect(mergeSettings({ packs: "nope" }).packs).toEqual({});
    expect(mergeSettings({ packs: [1, 2] }).packs).toEqual({});
    const s = mergeSettings({
      packs: {
        chiikawa: [{ id: "a", name: "하앗.wav" }, { id: 3, name: "x" }, null, "bad", { id: "b" }],
        usagi: "bad",
        hachiware: [],
      },
    });
    expect(s.packs).toEqual({ chiikawa: [{ id: "a", name: "하앗.wav" }] });
  });
});
