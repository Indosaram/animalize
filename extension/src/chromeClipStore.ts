import { base64ToBytes, bytesToBase64, newClipId, type ClipStore, type PackClipMeta } from "@/engine";

const CLIP_PREFIX = "animalize_clip_";
const INDEX_PREFIX = "animalize_clip_index_";

interface StoredClip {
  characterId: string;
  name: string;
  b64: string;
}

/**
 * Clip store shared by the popup and every content script: chrome.storage.local is per-extension,
 * while IndexedDB in a content script would belong to the visited page's origin.
 */
export function createChromeStorageClipStore(): ClipStore {
  const local = chrome.storage.local;
  const indexKey = (characterId: string) => `${INDEX_PREFIX}${characterId}`;
  const readIndex = async (characterId: string): Promise<PackClipMeta[]> => {
    const got = await local.get(indexKey(characterId));
    const list = got[indexKey(characterId)];
    return Array.isArray(list) ? (list as PackClipMeta[]) : [];
  };

  return {
    list: readIndex,
    async get(id) {
      const key = `${CLIP_PREFIX}${id}`;
      const got = await local.get(key);
      const row = got[key] as StoredClip | undefined;
      if (!row || typeof row.b64 !== "string") return null;
      return base64ToBytes(row.b64).buffer as ArrayBuffer;
    },
    async put(characterId, name, data) {
      const meta = { id: newClipId(), name };
      const row: StoredClip = { characterId, name, b64: bytesToBase64(new Uint8Array(data)) };
      await local.set({ [`${CLIP_PREFIX}${meta.id}`]: row });
      await local.set({ [indexKey(characterId)]: [...(await readIndex(characterId)), meta] });
      return meta;
    },
    async remove(characterId, id) {
      await local.remove(`${CLIP_PREFIX}${id}`);
      await local.set({ [indexKey(characterId)]: (await readIndex(characterId)).filter((c) => c.id !== id) });
    },
  };
}
