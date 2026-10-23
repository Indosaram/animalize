import { SETTINGS_STORAGE_KEY, mergeSettings, type Settings, type SettingsStore } from "@/engine";

export const chromeStore: SettingsStore = {
  async load(): Promise<Settings> {
    const got = await chrome.storage.local.get(SETTINGS_STORAGE_KEY);
    return mergeSettings(got[SETTINGS_STORAGE_KEY]);
  },
  async save(s: Settings): Promise<void> {
    await chrome.storage.local.set({ [SETTINGS_STORAGE_KEY]: s });
  },
  subscribe(cb: (s: Settings) => void): () => void {
    const handler = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area !== "local" || !(SETTINGS_STORAGE_KEY in changes)) return;
      cb(mergeSettings(changes[SETTINGS_STORAGE_KEY].newValue));
    };
    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
  },
};
