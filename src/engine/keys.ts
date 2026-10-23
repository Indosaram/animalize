const MODIFIER_PREFIXES = ["LShift", "RShift", "LControl", "RControl", "LAlt", "RAlt", "LMeta", "RMeta"];

const SHIFT_NUMS: Record<string, string> = {
  "1": "!",
  "2": "@",
  "3": "#",
  "4": "$",
  "5": "%",
  "6": "^",
  "7": "&",
  "8": "*",
  "9": "(",
  "0": ")",
};

/**
 * Normalizes a Rust device_query payload "KeyName,isShift" into a KeyboardEvent.key-like value.
 * Returns null for modifier keys that should not make a sound. Ported from the legacy src/App.jsx.
 */
export function normalizeTauriKey(payload: string): string | null {
  const parts = payload.split(",");
  let key = parts[0] ?? "";
  const isShift = parts[1] === "true";

  if (MODIFIER_PREFIXES.some((p) => key.startsWith(p)) || key === "CapsLock") return null;

  if (key.length === 1) {
    // already a single char
  } else if (key.startsWith("Key")) {
    key = key.substring(3);
  } else if (key.startsWith("Num")) {
    key = key.substring(3);
  }

  const specialKeys: Record<string, string> = {
    Return: "Enter",
    Enter: "Enter",
    Space: "Space",
    Backspace: "Backspace",
    Tab: "Tab",
    Escape: "Escape",
    Up: "ArrowUp",
    Down: "ArrowDown",
    Left: "ArrowLeft",
    Right: "ArrowRight",
    Delete: "Delete",
    Minus: isShift ? "_" : "-",
    Equal: isShift ? "+" : "=",
    LeftBracket: isShift ? "{" : "[",
    RightBracket: isShift ? "}" : "]",
    BackSlash: isShift ? "|" : "\\",
    Semicolon: isShift ? ":" : ";",
    Apostrophe: isShift ? '"' : "'",
    Comma: isShift ? "<" : ",",
    Dot: isShift ? ">" : ".",
    Slash: isShift ? "?" : "/",
    Grave: isShift ? "~" : "`",
  };

  if (Object.prototype.hasOwnProperty.call(specialKeys, key)) {
    return specialKeys[key];
  }
  if (key.length === 1 && /[a-z0-9]/i.test(key)) {
    if (isShift) return SHIFT_NUMS[key] ?? key.toUpperCase();
    // device_query reports letters upper-case; without shift they are lower-case
    return key.toLowerCase();
  }
  return key;
}

const CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
const JUNG = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ";
const JONG = ["", ..."ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ"];

const SYLLABLE_START = 0xac00;
const SYLLABLE_END = 0xd7a3;

export function isHangulSyllable(ch: string): boolean {
  const code = ch.codePointAt(0) ?? 0;
  return ch.length === 1 && code >= SYLLABLE_START && code <= SYLLABLE_END;
}

/** Splits Hangul syllables (U+AC00..U+D7A3) into compatibility jamo; other chars pass through. */
export function decomposeHangul(text: string): string[] {
  const out: string[] = [];
  for (const ch of text) {
    if (!isHangulSyllable(ch)) {
      out.push(ch);
      continue;
    }
    const idx = ch.codePointAt(0)! - SYLLABLE_START;
    const cho = Math.floor(idx / (21 * 28));
    const jung = Math.floor((idx % (21 * 28)) / 28);
    const jong = idx % 28;
    out.push(CHO[cho], JUNG[jung]);
    if (jong > 0) out.push(JONG[jong]);
  }
  return out;
}

/** Turns free text into the sequence of keys VoiceEngine.handleKey accepts. */
export function textToSoundKeys(text: string): string[] {
  const keys: string[] = [];
  for (const ch of decomposeHangul(text)) {
    if (ch === " " || ch === "\u3000") keys.push("Space");
    else if (ch === "\n") keys.push("Enter");
    else if (ch === "\t") keys.push("Tab");
    else if (ch === "\r") continue;
    else keys.push(ch);
  }
  return keys;
}
