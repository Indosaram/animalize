import { describe, expect, test } from "bun:test";
import { decomposeHangul, normalizeTauriKey, textToSoundKeys } from "./keys";

describe("normalizeTauriKey", () => {
  test.each([
    ["KeyA,true", "A"],
    ["KeyA,false", "a"],
    ["Space,false", "Space"],
    ["Slash,true", "?"],
    ["Slash,false", "/"],
    ["Key1,true", "!"],
    ["Key1,false", "1"],
    ["Return,false", "Enter"],
    ["Left,false", "ArrowLeft"],
  ])("%s -> %s", (payload, expected) => {
    expect(normalizeTauriKey(payload)).toBe(expected);
  });

  test.each(["LShift,false", "RControl,true", "LMeta,false", "CapsLock,false"])("%s -> null", (payload) => {
    expect(normalizeTauriKey(payload)).toBeNull();
  });
});

describe("decomposeHangul", () => {
  test("splits syllables into compatibility jamo", () => {
    expect(decomposeHangul("안녕")).toEqual(["ㅇ", "ㅏ", "ㄴ", "ㄴ", "ㅕ", "ㅇ"]);
    expect(decomposeHangul("가")).toEqual(["ㄱ", "ㅏ"]);
  });

  test("passes other characters through", () => {
    expect(decomposeHangul("a1 ㅋ")).toEqual(["a", "1", " ", "ㅋ"]);
  });
});

describe("textToSoundKeys", () => {
  test("maps whitespace to named keys", () => {
    expect(textToSoundKeys("hi 안\n")).toEqual(["h", "i", "Space", "ㅇ", "ㅏ", "ㄴ", "Enter"]);
  });
});
