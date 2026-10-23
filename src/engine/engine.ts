import { getCharacter } from "./characters";
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

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
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

  constructor(opts: VoiceEngineOptions) {
    this.assetRoot = `${opts.assetBase.replace(/\/+$/, "")}/assets/audio/`;
    this.ctxFactory = opts.audioContext;
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
    };
    if (prevClip && prevClip !== this.settings.clip?.dataUrl) this.bufferCache.delete(prevClip);
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

  private play(req: PlayRequest): void {
    this.plays += 1;
    globalThis.__animalizePlays = (globalThis.__animalizePlays ?? 0) + 1;
    const ctx = this.getContext();
    if (!ctx) return;
    this.startPlayback(ctx, req).catch((err) => {
      console.error("[animalize] audio playback error:", err);
    });
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
