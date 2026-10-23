import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { CHARACTERS, getCharacter } from "./characters";
import { DEFAULT_SETTINGS } from "./types";

const ROOT = join(import.meta.dir, "..", "..");

describe("CHARACTERS", () => {
  test("ids are in contract order", () => {
    expect(CHARACTERS.map((c) => c.id)).toEqual([
      "chiikawa",
      "hachiware",
      "usagi",
      "kurimanju",
      "female-1",
      "female-2",
      "female-3",
      "female-4",
      "male-1",
      "male-2",
      "male-3",
      "male-4",
    ]);
  });

  test.each(CHARACTERS.map((c) => [c.id, c] as const))("%s has a sample that exists on disk", (_id, c) => {
    expect(c.source.type).toBe("sample");
    if (c.source.type !== "sample") return;
    const file = join(ROOT, "public/assets/audio/animalese", c.source.gender, c.source.voice, "a.aac");
    expect(existsSync(file)).toBe(true);
    expect(c.pitch).toBeGreaterThanOrEqual(-12);
    expect(c.pitch).toBeLessThanOrEqual(12);
    expect(c.speed).toBeGreaterThanOrEqual(0.5);
    expect(c.speed).toBeLessThanOrEqual(2);
  });

  test("imitation presets are labelled as such", () => {
    for (const c of CHARACTERS.slice(0, 4)) expect(c.name).toMatch(/느낌|스타일/);
  });
});

describe("getCharacter", () => {
  test("custom applies settings.custom over its base", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      custom: { pitch: 5, speed: 1.5, variation: 0.4, squeak: 0.3, baseCharacterId: "male-2" },
    };
    const c = getCharacter("custom", settings);
    expect(c.id).toBe("custom");
    expect(c.face).toBe("custom");
    expect(c.pitch).toBe(5);
    expect(c.speed).toBe(1.5);
    expect(c.variation).toBe(0.4);
    expect(c.squeak).toBe(0.3);
    expect(c.source).toEqual({ type: "sample", gender: "male", voice: "voice_2" });
  });

  test("clip resolves to a clip source", () => {
    expect(getCharacter("clip").source).toEqual({ type: "clip" });
  });

  test("unknown id falls back to the first preset", () => {
    expect(getCharacter("nope").id).toBe("chiikawa");
  });
});
