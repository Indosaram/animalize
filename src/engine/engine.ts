import { getCharacter } from "./characters";
import { base64ToBytes, bytesToBase64, type ClipStore, type PackClipMeta } from "./clipStore";
import { decomposeHangul, isHangulSyllable, textToSoundKeys } from "./keys";
import { DEFAULT_SETTINGS, type Character, type Settings } from "./types";

declare global {
  // eslint-disable-next-line no-var
  var __animalizePlays: number | undefined;
}

if (typeof globalThis.__animalizePlays !== "number") globalThis.__animalizePlays = 0;

export const CLIP_READ_ERROR = "소리 파일을 읽을 수 없어요. mp3, wav, m4a 파일을 골라 주세요.";
export const CLIP_TOO_LARGE_ERROR = "파일이 너무 커요 (2MB 이하)";
export const MAX_CLIP_BYTES = 2 * 1024 * 1024;
export const PACK_TOO_LARGE_ERROR = "파일이 너무 커요 (1MB 이하)";
export const PACK_LIMIT_ERROR = "한 캐릭터에 소리는 12개까지 넣을 수 있어요";
export const PACK_NO_STORE_ERROR = "소리를 저장할 곳이 없어요. 앱을 다시 열어 주세요.";
export const MAX_PACK_CLIP_BYTES = 1024 * 1024;
export const MAX_PACK_CLIPS = 12;
const MAX_PACK_VOICES = 4;

const SYLLABLE_STAGGER_MS = 70;
const SPEAK_STEP_MS = 75;
const CLIP_SLICE_SECONDS = 0.28;

export class VoiceClipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VoiceClipError";
  }
}

export interface VoiceEngineOptions {
  /** URL prefix: "" for desktop ("/assets/..."), chrome.runtime.getURL("") for the extension */
  assetBase: string;
  audioContext?: () => AudioContext;
  /** where user-supplied character sound packs are stored */
  clipStore?: ClipStore;
  /** URL of the folder holding <characterId>/blips.json voice banks; omit to disable */
  bankBase?: string;
}

/** Phoneme map ported from the legacy src/utils/audioSystem.js (Hangul jamo + accented Latin). */
const PHONEME_SOURCES: Record<string, string[]> = {
  a: ["ㅋ", "à", "á", "â", "ã", "ä", "å", "æ", "ā", "ă", "ą", "ǎ"],
  A: ["À", "Á", "Â", "Ã", "Ä", "Å", "Æ", "Ā", "Ă", "Ą", "Ǎ"],
  b: ["ㅣ", "ḃ", "ḅ", "ḇ"],
  B: ["Ḃ", "Ḅ", "Ḇ"],
  c: ["ㅠ", "ç", "ć", "ĉ", "ċ", "č"],
  C: ["Ç", "Ć", "Ĉ", "Ċ", "Č"],
  d: ["ㅍ", "ď", "đ", "ḋ", "ḍ", "ḏ", "ḑ", "ḓ"],
  D: ["Ď", "Đ", "Ḋ", "Ḍ", "Ḏ", "Ḑ", "Ḓ"],
  e: ["ㄷ", "è", "é", "ê", "ë", "ē", "ĕ", "ė", "ę", "ě", "ẹ", "ẻ", "ẽ", "ế", "ề", "ể", "ễ", "ệ", "ğ"],
  E: ["È", "É", "Ê", "Ë", "Ē", "Ĕ", "Ė", "Ę", "Ě", "Ẹ", "Ẻ", "Ẽ", "Ế", "Ề", "Ể", "Ễ", "Ệ", "Ğ"],
  f: ["ㅎ", "ẟ"],
  g: ["ㅏ", "ĝ", "ğ", "ġ", "ģ", "ḡ"],
  G: ["Ĝ", "Ğ", "Ġ", "Ģ", "Ḡ"],
  h: ["ㅑ", "ĥ", "ȟ", "ḥ", "ḧ", "ḩ", "ḫ", "ẖ"],
  H: ["Ĥ", "Ȟ", "Ḥ", "Ḧ", "Ḩ", "Ḫ"],
  i: ["ㅇ", "ì", "í", "î", "ï", "ĩ", "ī", "ĭ", "į", "ı", "ỉ", "ị"],
  I: ["Ì", "Í", "Î", "Ï", "Ĩ", "Ī", "Ĭ", "Į", "İ", "Ỉ", "Ị"],
  j: ["ㅓ", "ĵ", "ǰ"],
  J: ["Ĵ"],
  k: ["ㅕ", "ķ", "ḱ", "ḳ", "ḵ", "ƙ"],
  K: ["Ķ", "Ḱ", "Ḳ", "Ḵ", "Ƙ"],
  l: ["ㅗ", "ĺ", "ļ", "ľ", "ŀ", "ł", "ḷ", "ḹ", "ḻ", "ḽ"],
  L: ["Ĺ", "Ļ", "Ľ", "Ŀ", "Ł", "Ḷ", "Ḹ", "Ḻ", "Ḽ"],
  m: ["ㅔ", "ḿ", "ṁ", "ṃ"],
  M: ["ㅖ", "Ḿ", "Ṁ", "Ṃ"],
  n: ["ㅐ", "ñ", "ń", "ņ", "ň", "ŉ", "ŋ", "ṇ", "ṉ", "ṋ"],
  N: ["ㅒ", "Ñ", "Ń", "Ņ", "Ň", "Ŋ", "Ṇ", "Ṉ", "Ṋ"],
  o: ["ㅈ", "ò", "ó", "ô", "õ", "ö", "ø", "ō", "ŏ", "ő", "ơ", "ǫ", "ǭ", "ọ", "ỏ", "ố", "ồ", "ổ", "ỗ", "ộ", "ớ", "ờ", "ở", "ỡ", "ợ"],
  O: ["ㅉ", "Ò", "Ó", "Ô", "Õ", "Ö", "Ø", "Ō", "Ŏ", "Ő", "Ơ", "Ǫ", "Ǭ", "Ọ", "Ỏ", "Ố", "Ồ", "Ổ", "Ỗ", "Ộ", "Ớ", "Ờ", "Ở", "Ỡ", "Ợ"],
  p: ["ㅊ", "ṕ", "ṗ"],
  P: ["Ṕ", "Ṗ"],
  q: ["ㄱ", "ɋ"],
  r: ["ㄹ", "ŕ", "ŗ", "ř", "ȑ", "ȓ", "ṙ", "ṛ", "ṝ", "ṟ"],
  R: ["Ŕ", "Ŗ", "Ř", "Ȑ", "Ȓ", "Ṙ", "Ṛ", "Ṝ", "Ṟ"],
  s: ["ㅌ", "ß", "ś", "ŝ", "ş", "š", "ṡ", "ṣ", "ṥ", "ṧ", "ṩ", "ẛ"],
  S: ["Ś", "Ŝ", "Ş", "Š", "Ṡ", "Ṣ", "Ṥ", "Ṧ", "Ṩ"],
  t: ["ㅁ", "ţ", "ť", "ŧ", "ṫ", "ṭ", "ṯ", "ṱ", "ẗ"],
  T: ["Ţ", "Ť", "Ŧ", "Ṫ", "Ṭ", "Ṯ", "Ṱ"],
  u: ["ㅅ", "ù", "ú", "û", "ü", "ũ", "ū", "ŭ", "ů", "ű", "ų", "ư", "ṳ", "ṵ", "ṷ", "ṹ", "ṻ", "ụ", "ủ", "ứ", "ừ", "ử", "ữ", "ự"],
  U: ["ㅆ", "Ù", "Ú", "Û", "Ü", "Ũ", "Ū", "Ŭ", "Ů", "Ű", "Ų", "Ư", "Ṳ", "Ṵ", "Ṷ", "Ṹ", "Ṻ", "Ụ", "Ủ", "Ứ", "Ừ", "Ử", "Ữ", "Ự"],
  v: ["ㅡ", "ṿ", "ʋ"],
  V: ["Ṿ"],
  w: ["ㄴ", "ŵ", "ẁ", "ẃ", "ẅ", "ẇ", "ẉ", "ẘ"],
  W: ["Ŵ", "Ẁ", "Ẃ", "Ẅ", "Ẇ", "Ẉ"],
  x: ["ㅜ", "ẋ", "ẍ"],
  X: ["Ẋ", "Ẍ"],
  y: ["ㅂ", "ý", "ÿ", "ŷ", "ȳ", "ẏ", "ẙ", "ỳ", "ỵ", "ỷ", "ỹ"],
  Y: ["ㅃ", "Ý", "Ŷ", "Ȳ", "Ẏ", "Ỳ", "Ỵ", "Ỷ", "Ỹ"],
  z: ["ㅛ", "ź", "ż", "ž", "ẑ", "ẓ", "ẕ", "ȥ"],
  Z: ["Ź", "Ż", "Ž", "Ẑ", "Ẓ", "Ẕ"],
};

const CHAR_TO_PHONEME: Record<string, string> = {};
for (const [phoneme, chars] of Object.entries(PHONEME_SOURCES)) {
  for (const ch of chars) CHAR_TO_PHONEME[ch] = phoneme;
}

/** Compound jamo absent from the legacy map fall back to their leading component. */
const COMPOUND_JAMO: Record<string, string> = {
  ㄲ: "ㄱ", ㄸ: "ㄷ", ㅘ: "ㅗ", ㅙ: "ㅗ", ㅚ: "ㅗ", ㅝ: "ㅜ", ㅞ: "ㅜ", ㅟ: "ㅜ", ㅢ: "ㅡ",
  ㄳ: "ㄱ", ㄵ: "ㄴ", ㄶ: "ㄴ", ㄺ: "ㄹ", ㄻ: "ㄹ", ㄼ: "ㄹ", ㄽ: "ㄹ", ㄾ: "ㄹ", ㄿ: "ㄹ", ㅀ: "ㄹ", ㅄ: "ㅂ",
};

const SPECIAL_SFX: Record<string, string> = {
  "?": "question",
  "~": "tilde",
  "!": "exclamation",
  "@": "at",
  "#": "pound",
  $: "dollar",
  "%": "percent",
  "^": "caret",
  "&": "ampersand",
  "*": "asterisk",
  "(": "parenthesis_open",
  ")": "parenthesis_closed",
  "[": "bracket_open",
  "]": "bracket_closed",
  "{": "brace_open",
  "}": "brace_closed",
  "/": "slash_forward",
  "\\": "slash_back",
};

const ARROWS: Record<string, string> = {
  ArrowLeft: "arrow_left",
  ArrowUp: "arrow_up",
  ArrowRight: "arrow_right",
  ArrowDown: "arrow_down",
};

function letterSound(key: string): string | null {
  const ch = key.charAt(0);
  if (/[a-zA-Z]/.test(ch)) return ch;
  return CHAR_TO_PHONEME[ch] ?? CHAR_TO_PHONEME[COMPOUND_JAMO[ch] ?? ""] ?? null;
}

const isAlpha = (s: string) => s.length === 1 && /\p{Letter}/u.test(s);
const isUpperCase = (s: string) => s === s.toUpperCase() && s !== s.toLowerCase();

/** One resolved sound request. */
interface PlayRequest {
  kind: "sfx" | "voice";
  /** asset path relative to the asset root without extension, e.g. "sfx/enter" */
  path: string;
  volume: number;
  randomPitch: number;
  /** extra semitones on top of the character pitch */
  pitch: number;
  /** a..z letter used for clip pitch offsets */
  letter?: string;
}

const BANK_CHARACTERS = new Set(["chiikawa", "hachiware", "usagi", "momonga", "shisa", "kurimanju"]);
const MAX_BANK_VOICES = 3;

/** Per-character letter blips built by scripts/build-blip-banks.py: letter -> [start, end] seconds in one sprite. */
interface BlipBank {
  letters: Record<string, [number, number]>;
  buffer: AudioBuffer;
}

function isSeededClipName(characterId: string, name: string): boolean {
  return new RegExp(`^${characterId}-\\d+\\.m4a$`).test(name);
}

function mimeForName(name: string): string {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  const map: Record<string, string> = {
    mp3: "audio/mpeg",
    wav: "audio/wav",
    m4a: "audio/mp4",
    aac: "audio/aac",
    ogg: "audio/ogg",
    webm: "audio/webm",
  };
  return map[ext] ?? "audio/mpeg";
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class VoiceEngine {
  private readonly assetRoot: string;
  private readonly ctxFactory?: () => AudioContext;
  private ctx: AudioContext | null = null;
  private ctxUnavailable = false;
  private settings: Settings = structuredClone(DEFAULT_SETTINGS);
  private plays = 0;
  private readonly bufferCache = new Map<string, Promise<AudioBuffer>>();
  private readonly clipStore?: ClipStore;
  private readonly packBuffers = new Map<string, Promise<AudioBuffer | null>>();
  private readonly lastPackPick = new Map<string, string>();
  private readonly packVoices: AudioBufferSourceNode[] = [];
  private readonly pending = new Set<Promise<void>>();
  private readonly bankBase?: string;
  private readonly banks = new Map<string, Promise<BlipBank | null>>();
  private readonly bankVoices: AudioBufferSourceNode[] = [];

  constructor(opts: VoiceEngineOptions) {
    this.assetRoot = `${opts.assetBase.replace(/\/+$/, "")}/assets/audio/`;
    this.ctxFactory = opts.audioContext;
    this.clipStore = opts.clipStore;
    this.bankBase = opts.bankBase?.replace(/\/+$/, "");
  }

  /** Resolves once every playback started so far has been scheduled (or failed). */
  async settled(): Promise<void> {
    while (this.pending.size) await Promise.allSettled([...this.pending]);
  }

  /** Validates and stores user clips for a character; all-or-nothing. Returns the new pack. */
  async addPackClips(characterId: string, files: { data: ArrayBuffer; name: string }[]): Promise<PackClipMeta[]> {
    const store = this.clipStore;
    if (!store) throw new VoiceClipError(PACK_NO_STORE_ERROR);
    const existing = this.settings.packs[characterId] ?? [];
    if (existing.length + files.length > MAX_PACK_CLIPS) throw new VoiceClipError(PACK_LIMIT_ERROR);
    for (const f of files) if (f.data.byteLength > MAX_PACK_CLIP_BYTES) throw new VoiceClipError(PACK_TOO_LARGE_ERROR);
    const ctx = this.getContext();
    if (!ctx) throw new VoiceClipError(CLIP_READ_ERROR);
    const decoded: AudioBuffer[] = [];
    for (const f of files) {
      let buffer: AudioBuffer;
      try {
        buffer = await ctx.decodeAudioData(f.data.slice(0));
      } catch (err) {
        const e = new VoiceClipError(CLIP_READ_ERROR);
        (e as Error & { cause?: unknown }).cause = err;
        throw e;
      }
      if (!buffer || !(buffer.duration > 0)) throw new VoiceClipError(CLIP_READ_ERROR);
      decoded.push(buffer);
    }
    const added: PackClipMeta[] = [];
    for (let i = 0; i < files.length; i++) {
      const meta = await store.put(characterId, files[i].name, files[i].data);
      this.packBuffers.set(meta.id, Promise.resolve(decoded[i]));
      added.push(meta);
    }
    const next = [...existing, ...added];
    this.settings = { ...this.settings, packs: { ...this.settings.packs, [characterId]: next } };
    return next;
  }

  async removePackClip(characterId: string, id: string): Promise<PackClipMeta[]> {
    await this.clipStore?.remove(characterId, id);
    this.packBuffers.delete(id);
    const packs = { ...this.settings.packs };
    const next = (packs[characterId] ?? []).filter((c) => c.id !== id);
    if (next.length) packs[characterId] = next;
    else delete packs[characterId];
    this.settings = { ...this.settings, packs };
    return next;
  }

  /** Plays one pack clip regardless of the enabled switch. */
  async previewPackClip(characterId: string, id: string): Promise<void> {
    this.countPlay();
    const ctx = this.getContext();
    if (!ctx) return;
    await this.track(this.startPackPlayback(ctx, id, getCharacter(characterId, this.settings).speed, 1));
  }

  get playCount(): number {
    return this.plays;
  }

  getSettings(): Settings {
    return structuredClone(this.settings);
  }

  setSettings(s: Partial<Settings>): void {
    const prevClip = this.settings.clip?.dataUrl;
    this.settings = {
      ...this.settings,
      ...s,
      custom: { ...this.settings.custom, ...(s.custom ?? {}) },
      packs: s.packs ? { ...s.packs } : this.settings.packs,
    };
    if (prevClip && prevClip !== this.settings.clip?.dataUrl) this.bufferCache.delete(prevClip);
    if (s.packs) {
      const live = new Set(Object.values(this.settings.packs).flatMap((p) => p.map((c) => c.id)));
      for (const id of this.packBuffers.keys()) if (!live.has(id)) this.packBuffers.delete(id);
    }
  }

  handleKey(key: string): void {
    if (!this.settings.enabled) return;
    this.playKey(key);
  }

  /** Plays a sentence as a preview regardless of the enabled switch. */
  async speak(text: string): Promise<void> {
    const character = this.character();
    const step = SPEAK_STEP_MS / character.speed;
    const keys = textToSoundKeys(text);
    for (let i = 0; i < keys.length; i++) {
      this.playKey(keys[i]);
      if (i < keys.length - 1) await sleep(step);
    }
  }

  async loadClip(data: ArrayBuffer, name: string): Promise<{ name: string; dataUrl: string }> {
    if (data.byteLength > MAX_CLIP_BYTES) throw new VoiceClipError(CLIP_TOO_LARGE_ERROR);
    const ctx = this.getContext();
    if (!ctx) throw new VoiceClipError(CLIP_READ_ERROR);
    const dataUrl = `data:${mimeForName(name)};base64,${bytesToBase64(new Uint8Array(data))}`;
    let buffer: AudioBuffer;
    try {
      // decodeAudioData detaches its input, so decode a copy
      buffer = await ctx.decodeAudioData(data.slice(0));
    } catch (err) {
      const e = new VoiceClipError(CLIP_READ_ERROR);
      (e as Error & { cause?: unknown }).cause = err;
      throw e;
    }
    if (!buffer || !(buffer.duration > 0)) throw new VoiceClipError(CLIP_READ_ERROR);
    this.bufferCache.set(dataUrl, Promise.resolve(buffer));
    return { name, dataUrl };
  }

  private character(): Character {
    return getCharacter(this.settings.characterId, this.settings);
  }

  private playKey(key: string): void {
    if (key.length === 1 && isHangulSyllable(key)) {
      decomposeHangul(key).forEach((jamo, i) => {
        if (i === 0) this.playKey(jamo);
        else setTimeout(() => this.playKey(jamo), (i * SYLLABLE_STAGGER_MS) / this.character().speed);
      });
      return;
    }
    const req = this.resolve(key);
    if (!req) return;
    const mode = this.settings.mode;
    if (req.kind === "sfx" && this.bankBase && this.hasBank(this.settings.characterId)) return;
    if (mode === "voice" && req.kind === "sfx") return;
    if (mode === "sfx" && req.kind === "voice") return;
    this.play(req);
  }

  /** Key -> sound rules, ported from the legacy audioSystem.handleInput. */
  private resolve(key: string): PlayRequest | null {
    const sfx = (name: string, volume: number, randomPitch = 0): PlayRequest => ({
      kind: "sfx",
      path: `sfx/${name}`,
      volume,
      randomPitch,
      pitch: 0,
    });

    if (key.startsWith("Arrow")) return ARROWS[key] ? sfx(ARROWS[key], 0.4) : null;
    if (key === "Backspace" || key === "Delete") return sfx("backspace", 1.0);
    if (key === "Enter") return sfx("enter", 0.2);
    if (key === "Tab") return sfx("tab", 0.5);
    if (key === "Space" || key === " " || key === "Escape") return sfx("default", 0.3);
    if (SPECIAL_SFX[key]) return sfx(SPECIAL_SFX[key], 0.6);

    const c = this.character();
    const voiceDir = c.source.type === "sample" ? `${c.source.gender}/${c.source.voice}` : "female/voice_1";

    if (key.length === 1 && /[0-9]/.test(key)) {
      const num = Number(key);
      const idx = num === 0 ? 9 : num - 1;
      return {
        kind: "voice",
        path: `vocals/${voiceDir}/${idx}`,
        volume: 1.0,
        randomPitch: 0,
        pitch: 0,
        letter: String.fromCharCode(97 + ((idx * 3) % 26)),
      };
    }

    if (isAlpha(key)) {
      const letter = letterSound(key);
      if (!letter) return null;
      const lower = letter.toLowerCase();
      const upper = isUpperCase(key) || isUpperCase(letter);
      return {
        kind: "voice",
        path: `animalese/${voiceDir}/${lower}`,
        volume: upper ? 0.7 : 0.5,
        randomPitch: upper ? 0.15 : 0,
        pitch: upper ? 1.6 : 0,
        letter: lower,
      };
    }

    return sfx("default", 0.4, 0.4);
  }

  private getContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    if (this.ctxUnavailable) return null;
    try {
      if (this.ctxFactory) {
        this.ctx = this.ctxFactory();
      } else {
        const g = globalThis as unknown as {
          AudioContext?: typeof AudioContext;
          webkitAudioContext?: typeof AudioContext;
        };
        const Ctor = g.AudioContext ?? g.webkitAudioContext;
        if (Ctor) this.ctx = new Ctor();
      }
    } catch (err) {
      console.warn("[animalize] AudioContext unavailable:", err);
    }
    if (!this.ctx) this.ctxUnavailable = true;
    return this.ctx;
  }

  private countPlay(): void {
    this.plays += 1;
    globalThis.__animalizePlays = (globalThis.__animalizePlays ?? 0) + 1;
  }

  private track(p: Promise<void>): Promise<void> {
    const tracked = p.catch((err) => {
      console.error("[animalize] audio playback error:", err);
    });
    this.pending.add(tracked);
    void tracked.finally(() => this.pending.delete(tracked));
    return tracked;
  }

  /** Random pack clip id for the character, never the same one twice in a row when possible. */
  private pickPackClip(characterId: string, pack: PackClipMeta[]): string {
    const last = this.lastPackPick.get(characterId);
    const pool = pack.length > 1 ? pack.filter((c) => c.id !== last) : pack;
    const id = pool[Math.floor(Math.random() * pool.length)].id;
    this.lastPackPick.set(characterId, id);
    return id;
  }

  private play(req: PlayRequest): void {
    this.countPlay();
    const ctx = this.getContext();
    if (!ctx) return;
    const characterId = this.settings.characterId;
    const pack = req.kind === "voice" ? this.settings.packs[characterId] : undefined;
    const customPack = pack?.length && !pack.every((c) => isSeededClipName(characterId, c.name));
    if (req.kind === "voice" && !customPack && this.bankBase && this.hasBank(characterId)) {
      void this.track(this.startBankPlayback(ctx, characterId, req));
      return;
    }
    if (pack && pack.length) {
      const id = this.pickPackClip(characterId, pack);
      void this.track(this.startPackPlayback(ctx, id, this.character().speed, req.volume >= 0.7 ? 1 : 0.85));
      return;
    }
    void this.track(this.startPlayback(ctx, req));
  }

  private hasBank(characterId: string): boolean {
    return BANK_CHARACTERS.has(characterId);
  }

  private loadBank(ctx: AudioContext, characterId: string): Promise<BlipBank | null> {
    let p = this.banks.get(characterId);
    if (!p) {
      const dir = `${this.bankBase}/${characterId}/`;
      p = (async () => {
        try {
          const res = await fetch(dir + "blips.json");
          if (!res.ok) return null;
          const meta = (await res.json()) as { sprite: string; letters: Record<string, [number, number]> };
          const audio = await fetch(dir + meta.sprite);
          if (!audio.ok) return null;
          const buffer = await ctx.decodeAudioData(await audio.arrayBuffer());
          return { letters: meta.letters, buffer };
        } catch (err) {
          console.warn(`[animalize] voice bank for ${characterId} unavailable`, err);
          return null;
        }
      })();
      this.banks.set(characterId, p);
    }
    return p;
  }

  /** Plays the character's letter blip: an untouched slice of their real voice (no pitch or speed change). */
  private async startBankPlayback(ctx: AudioContext, characterId: string, req: PlayRequest): Promise<void> {
    if (ctx.state === "suspended") await ctx.resume();
    const bank = await this.loadBank(ctx, characterId);
    if (!bank) {
      const pack = this.settings.packs[characterId];
      if (pack?.length) await this.startPackPlayback(ctx, this.pickPackClip(characterId, pack), 1, 0.9);
      else await this.startPlayback(ctx, req);
      return;
    }
    const span = bank.letters[req.letter ?? "a"] ?? bank.letters.a;
    if (!span) return;
    const [start, end] = span;

    const source = ctx.createBufferSource();
    source.buffer = bank.buffer;
    const gain = ctx.createGain();
    gain.gain.value = (req.volume >= 0.7 ? 1 : 0.9) * this.settings.volume * 0.95;
    gain.connect(ctx.destination);
    source.connect(gain);
    source.playbackRate.value = 1;
    source.detune.value = 0;
    this.bankVoices.push(source);
    source.onended = () => {
      const i = this.bankVoices.indexOf(source);
      if (i >= 0) this.bankVoices.splice(i, 1);
    };
    while (this.bankVoices.length > MAX_BANK_VOICES) {
      const oldest = this.bankVoices.shift()!;
      try {
        oldest.stop();
      } catch {
        // already stopped
      }
    }
    source.start(0, start, end - start);
  }

  private loadPackBuffer(ctx: AudioContext, id: string): Promise<AudioBuffer | null> {
    let p = this.packBuffers.get(id);
    if (!p) {
      const store = this.clipStore;
      p = (async () => {
        const data = store ? await store.get(id) : null;
        return data ? ctx.decodeAudioData(data.slice(0)) : null;
      })();
      this.packBuffers.set(id, p);
      p.then(
        (b) => {
          if (!b) this.packBuffers.delete(id);
        },
        () => this.packBuffers.delete(id),
      );
    }
    return p;
  }

  private async startPackPlayback(ctx: AudioContext, id: string, speed: number, volume: number): Promise<void> {
    if (ctx.state === "suspended") await ctx.resume();
    const buffer = await this.loadPackBuffer(ctx, id);
    if (!buffer) return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = volume * this.settings.volume * 0.95;
    gain.connect(ctx.destination);
    source.connect(gain);
    source.playbackRate.value = speed;
    source.detune.value = Math.random() * 200 - 100;
    this.packVoices.push(source);
    source.onended = () => {
      const i = this.packVoices.indexOf(source);
      if (i >= 0) this.packVoices.splice(i, 1);
    };
    while (this.packVoices.length > MAX_PACK_VOICES) {
      const oldest = this.packVoices.shift()!;
      try {
        oldest.stop();
      } catch {
        // already stopped
      }
    }
    source.start();
  }

  private loadBuffer(ctx: AudioContext, url: string): Promise<AudioBuffer> {
    let p = this.bufferCache.get(url);
    if (!p) {
      p = (async () => {
        let bytes: ArrayBuffer;
        if (url.startsWith("data:")) {
          const b64 = url.slice(url.indexOf(",") + 1);
          bytes = base64ToBytes(b64).buffer as ArrayBuffer;
        } else {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`Failed to load sound: ${url}`);
          bytes = await res.arrayBuffer();
        }
        return ctx.decodeAudioData(bytes);
      })();
      p.catch(() => this.bufferCache.delete(url));
      this.bufferCache.set(url, p);
    }
    return p;
  }

  private async startPlayback(ctx: AudioContext, req: PlayRequest): Promise<void> {
    if (ctx.state === "suspended") await ctx.resume();
    const c = this.character();
    const isVoice = req.kind === "voice";
    const clip = isVoice && c.source.type === "clip" ? this.settings.clip : null;
    if (isVoice && c.source.type === "clip" && !clip) return;

    const url = clip ? clip.dataUrl : `${this.assetRoot}${req.path}.aac`;
    const buffer = await this.loadBuffer(ctx, url);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    const level = req.volume * this.settings.volume * 0.95;
    gain.gain.value = level;
    gain.connect(ctx.destination);
    source.connect(gain);

    let semitones = req.pitch;
    let variation = req.randomPitch;
    if (isVoice) {
      semitones += c.pitch;
      variation += c.variation;
      if (clip && req.letter) {
        const idx = Math.max(0, Math.min(25, req.letter.charCodeAt(0) - 97));
        semitones += Math.round((idx / 25) * 12 - 6);
      }
      source.playbackRate.value = c.speed;
    }
    const jitter = (Math.random() * 600 - 300) * variation;
    source.detune.value = semitones * 100 + jitter;

    if (clip) {
      source.start(0, 0, Math.min(buffer.duration, CLIP_SLICE_SECONDS));
    } else {
      source.start();
    }

    const squeak = isVoice ? c.squeak ?? 0 : 0;
    if (squeak > 0) this.chirp(ctx, semitones + jitter / 100, squeak * level);
  }

  /** Short synthesized chirp layered on a syllable. */
  private chirp(ctx: AudioContext, semitones: number, amount: number): void {
    const now = ctx.currentTime;
    const dur = 0.06;
    const base = 880 * Math.pow(2, semitones / 12);
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(base, now);
    osc.frequency.exponentialRampToValueAtTime(base * 1.5, now + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, amount * 0.25), now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + dur + 0.01);
  }
}
