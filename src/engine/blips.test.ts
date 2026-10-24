import { describe, expect, test } from "bun:test";
import { createMemoryClipStore } from "./clipStore";
import { VoiceEngine } from "./engine";

const LETTERS = "abcdefghijklmnopqrstuvwxyz";
const BLIPS = {
  sprite: "blips.m4a",
  letters: Object.fromEntries([...LETTERS].map((l, i) => [l, [i * 0.2, i * 0.2 + 0.1]])),
};
const startOf = (letter: string) => BLIPS.letters[letter][0];

function fakeBankContext() {
  const started: { offset: number; duration: number; detune: number; rate: number }[] = [];
  const ctx = {
    state: "running",
    currentTime: 0,
    destination: {},
    resume: () => Promise.resolve(),
    decodeAudioData: () => Promise.resolve({ duration: 6 } as unknown as AudioBuffer),
    createGain: () => ({ gain: { value: 1 }, connect() {} }),
    createBufferSource: () => {
      const node = {
        buffer: null,
        playbackRate: { value: 1 },
        detune: { value: 0 },
        onended: null,
        connect() {},
        start(_when: number, offset = 0, duration = 0) {
          started.push({ offset, duration, detune: node.detune.value, rate: node.playbackRate.value });
        },
        stop() {},
      };
      return node;
    },
  };
  return { ctx: ctx as unknown as AudioContext, started };
}

function withBankFetch<T>(run: (requested: string[]) => Promise<T>): Promise<T> {
  const original = globalThis.fetch;
  const requested: string[] = [];
  globalThis.fetch = (async (url: string) => {
    requested.push(String(url));
    if (String(url).endsWith("blips.json")) return new Response(JSON.stringify(BLIPS));
    if (String(url).endsWith("blips.m4a")) return new Response(new Uint8Array([1, 2, 3]));
    return new Response("missing", { status: 404 });
  }) as typeof fetch;
  return run(requested).finally(() => {
    globalThis.fetch = original;
  });
}

function bankEngine(characterId: string, fake = fakeBankContext()) {
  const engine = new VoiceEngine({ assetBase: "", audioContext: () => fake.ctx, bankBase: "/banks", clipStore: createMemoryClipStore() });
  engine.setSettings({ characterId });
  return { engine, ...fake };
}

describe("character letter blips", () => {
  test("each letter plays its own blip from the selected character's bank only", () =>
    withBankFetch(async (requested) => {
      const { engine, started } = bankEngine("hachiware");
      for (const k of ["h", "i", "k", "k"]) engine.handleKey(k);
      await engine.settled();
      expect(requested.every((u) => u.startsWith("/banks/hachiware/"))).toBe(true);
      expect(started.map((s) => s.offset)).toEqual([startOf("h"), startOf("i"), startOf("k"), startOf("k")]);
      for (const s of started) {
        expect(s.duration).toBeCloseTo(0.1, 5);
        expect(s.detune).toBe(0);
        expect(s.rate).toBe(1);
      }
    }));

  test("hangul syllables play one blip per jamo, like the animalese letters", () =>
    withBankFetch(async () => {
      const { engine, started } = bankEngine("momonga");
      engine.handleKey("ㅎ");
      engine.handleKey("ㅏ");
      await engine.settled();
      expect(started.map((s) => s.offset)).toEqual([startOf("f"), startOf("g")]);
    }));

  test("switching character switches the bank", () =>
    withBankFetch(async (requested) => {
      const { engine } = bankEngine("chiikawa");
      engine.handleKey("a");
      await engine.settled();
      engine.setSettings({ characterId: "kurimanju" });
      engine.handleKey("a");
      await engine.settled();
      expect(requested.filter((u) => u.endsWith("blips.json"))).toEqual(["/banks/chiikawa/blips.json", "/banks/kurimanju/blips.json"]);
    }));

  test("keys without a voice stay silent instead of playing animalese sound effects", () =>
    withBankFetch(async (requested) => {
      const { engine, started } = bankEngine("shisa");
      for (const k of ["Space", "Enter", "Backspace", "?", "!", "ArrowLeft", ","]) engine.handleKey(k);
      await engine.settled();
      expect(requested.length).toBe(0);
      expect(started.length).toBe(0);
    }));

  test("old saved sound files never override the synthesized character voice", () =>
    withBankFetch(async (requested) => {
      const { engine, started } = bankEngine("usagi");
      await engine.addPackClips("usagi", [{ data: new Uint8Array([0x52, 1]).buffer as ArrayBuffer, name: "mine.wav" }]);
      engine.handleKey("a");
      await engine.settled();
      expect(requested).toEqual(["/banks/usagi/blips.json", "/banks/usagi/blips.m4a"]);
      expect(started.map((s) => s.offset)).toEqual([startOf("a")]);
    }));
});
