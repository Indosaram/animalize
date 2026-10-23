import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { SETTINGS_STORAGE_KEY, localStorageStore } from "./storage";
import { DEFAULT_SETTINGS } from "./types";

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(k: string) {
    return this.data.has(k) ? this.data.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, String(v));
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
  clear() {
    this.data.clear();
  }
}

const g = globalThis as { localStorage?: unknown };
let original: unknown;

beforeEach(() => {
  original = g.localStorage;
  g.localStorage = new MemoryStorage();
});

afterEach(() => {
  g.localStorage = original;
});

describe("localStorageStore", () => {
  test("returns defaults when empty", async () => {
    expect(await localStorageStore.load()).toEqual(DEFAULT_SETTINGS);
  });

  test("tolerates malformed JSON", async () => {
    (g.localStorage as MemoryStorage).setItem(SETTINGS_STORAGE_KEY, "{not json");
    expect(await localStorageStore.load()).toEqual(DEFAULT_SETTINGS);
  });

  test("merges partial stored values over defaults", async () => {
    (g.localStorage as MemoryStorage).setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ volume: 0.2, mode: "bogus", custom: { pitch: 4 } }),
    );
    const s = await localStorageStore.load();
    expect(s.volume).toBe(0.2);
    expect(s.mode).toBe("all");
    expect(s.custom).toEqual({ ...DEFAULT_SETTINGS.custom, pitch: 4 });
  });

  test("save then load round-trips", async () => {
    const s = { ...DEFAULT_SETTINGS, characterId: "usagi", clip: { name: "a.mp3", dataUrl: "data:audio/mpeg;base64,AA==" } };
    await localStorageStore.save(s);
    expect(await localStorageStore.load()).toEqual(s);
  });
});
