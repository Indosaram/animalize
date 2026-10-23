import type { CharacterId } from "./types";

export interface PackClipMeta {
  id: string;
  name: string;
}

/** Framework-free storage for user-supplied character sound clips (raw audio bytes). */
export interface ClipStore {
  list(characterId: CharacterId): Promise<PackClipMeta[]>;
  get(id: string): Promise<ArrayBuffer | null>;
  put(characterId: CharacterId, name: string, data: ArrayBuffer): Promise<PackClipMeta>;
  remove(characterId: CharacterId, id: string): Promise<void>;
}

export function newClipId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

interface StoredClip {
  id: string;
  characterId: CharacterId;
  name: string;
  data: ArrayBuffer;
  createdAt: number;
}

export function createMemoryClipStore(): ClipStore {
  const clips = new Map<string, StoredClip>();
  let seq = 0;
  return {
    async list(characterId) {
      return [...clips.values()]
        .filter((c) => c.characterId === characterId)
        .map(({ id, name }) => ({ id, name }));
    },
    async get(id) {
      const c = clips.get(id);
      return c ? c.data.slice(0) : null;
    },
    async put(characterId, name, data) {
      const id = newClipId();
      clips.set(id, { id, characterId, name, data: data.slice(0), createdAt: seq++ });
      return { id, name };
    },
    async remove(_characterId, id) {
      clips.delete(id);
    },
  };
}

const DB_NAME = "animalize_clips";
const DB_STORE = "clips";

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** IndexedDB-backed store for the desktop app (same origin as the UI). */
export function createIndexedDbClipStore(): ClipStore {
  let dbPromise: Promise<IDBDatabase> | null = null;
  const db = () => {
    if (!dbPromise) {
      dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
        const open = indexedDB.open(DB_NAME, 1);
        open.onupgradeneeded = () => {
          const store = open.result.createObjectStore(DB_STORE, { keyPath: "id" });
          store.createIndex("characterId", "characterId");
        };
        open.onsuccess = () => resolve(open.result);
        open.onerror = () => reject(open.error);
      });
      dbPromise.catch(() => (dbPromise = null));
    }
    return dbPromise;
  };
  const tx = async (mode: IDBTransactionMode) => (await db()).transaction(DB_STORE, mode).objectStore(DB_STORE);

  return {
    async list(characterId) {
      const store = await tx("readonly");
      const rows = await request(store.index("characterId").getAll(characterId) as IDBRequest<StoredClip[]>);
      return rows.sort((a, b) => a.createdAt - b.createdAt).map(({ id, name }) => ({ id, name }));
    },
    async get(id) {
      const store = await tx("readonly");
      const row = await request(store.get(id) as IDBRequest<StoredClip | undefined>);
      return row ? row.data : null;
    },
    async put(characterId, name, data) {
      const id = newClipId();
      const store = await tx("readwrite");
      await request(store.put({ id, characterId, name, data: data.slice(0), createdAt: Date.now() } satisfies StoredClip));
      return { id, name };
    },
    async remove(_characterId, id) {
      const store = await tx("readwrite");
      await request(store.delete(id));
    },
  };
}
