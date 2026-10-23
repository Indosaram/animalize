import { DEFAULT_SETTINGS, type Settings } from "./types";

export interface SettingsStore {
  load(): Promise<Settings>;
  save(s: Settings): Promise<void>;
  subscribe?(cb: (s: Settings) => void): () => void;
}

export const SETTINGS_STORAGE_KEY = "animalize_settings_v2";

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Merges an untrusted stored value over DEFAULT_SETTINGS, keeping only well-typed fields. */
export function mergeSettings(raw: unknown): Settings {
  const base: Settings = structuredClone(DEFAULT_SETTINGS);
  if (!isObject(raw)) return base;
  if (typeof raw.enabled === "boolean") base.enabled = raw.enabled;
  if (typeof raw.volume === "number" && Number.isFinite(raw.volume)) {
    base.volume = Math.min(1, Math.max(0, raw.volume));
  }
  if (typeof raw.characterId === "string" && raw.characterId) base.characterId = raw.characterId;
  if (raw.mode === "all" || raw.mode === "voice" || raw.mode === "sfx") base.mode = raw.mode;
  if (isObject(raw.custom)) {
    const c = raw.custom;
    for (const k of ["pitch", "speed", "variation", "squeak"] as const) {
      if (typeof c[k] === "number" && Number.isFinite(c[k])) base.custom[k] = c[k] as number;
    }
    if (typeof c.baseCharacterId === "string" && c.baseCharacterId) {
      base.custom.baseCharacterId = c.baseCharacterId;
    }
  }
  if (isObject(raw.clip) && typeof raw.clip.name === "string" && typeof raw.clip.dataUrl === "string") {
    base.clip = { name: raw.clip.name, dataUrl: raw.clip.dataUrl };
  }
  if (isObject(raw.packs)) {
    for (const [characterId, list] of Object.entries(raw.packs)) {
      if (!characterId || !Array.isArray(list)) continue;
      const clips = list
        .filter((c): c is { id: string; name: string } => isObject(c) && typeof c.id === "string" && !!c.id && typeof c.name === "string")
        .slice(0, 12)
        .map((c) => ({ id: c.id, name: c.name }));
      if (clips.length) base.packs[characterId] = clips;
    }
  }
  return base;
}

function storage(): Storage | null {
  try {
    return (globalThis as { localStorage?: Storage }).localStorage ?? null;
  } catch {
    return null;
  }
}

export const localStorageStore: SettingsStore = {
  async load() {
    const ls = storage();
    if (!ls) return structuredClone(DEFAULT_SETTINGS);
    let parsed: unknown = null;
    try {
      const text = ls.getItem(SETTINGS_STORAGE_KEY);
      parsed = text ? JSON.parse(text) : null;
    } catch (err) {
      console.warn("[animalize] ignoring malformed settings:", err);
    }
    return mergeSettings(parsed);
  },
  async save(s) {
    storage()?.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(s));
  },
  subscribe(cb) {
    const target = globalThis as {
      addEventListener?: (t: string, h: (e: StorageEvent) => void) => void;
      removeEventListener?: (t: string, h: (e: StorageEvent) => void) => void;
    };
    if (!target.addEventListener || !target.removeEventListener) return () => {};
    const handler = (e: StorageEvent) => {
      if (e.key !== SETTINGS_STORAGE_KEY) return;
      let parsed: unknown = null;
      try {
        parsed = e.newValue ? JSON.parse(e.newValue) : null;
      } catch {
        parsed = null;
      }
      cb(mergeSettings(parsed));
    };
    target.addEventListener("storage", handler);
    return () => target.removeEventListener?.("storage", handler);
  },
};
