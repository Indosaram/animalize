import { useEffect, useMemo } from "react";

import { VoiceEngine, createIndexedDbClipStore, localStorageStore, normalizeTauriKey } from "@/engine";
import PermissionBanner from "@/app/PermissionBanner";
import VoiceStudio from "@/app/VoiceStudio";

declare global {
  interface Window {
    __animalizeEngine?: VoiceEngine;
  }
}

const inTauri = () => "__TAURI_INTERNALS__" in window;

export default function App() {
  const engine = useMemo(() => new VoiceEngine({ assetBase: "", clipStore: createIndexedDbClipStore(), bankBase: "/banks" }), []);

  useEffect(() => {
    window.__animalizeEngine = engine;
    if (!inTauri()) return;
    const unlisteners: Array<() => void> = [];
    let cancelled = false;
    import("@tauri-apps/api/event").then(async ({ listen }) => {
      const offKey = await listen<string>("global-keydown", (event) => {
        if (document.hasFocus()) return;
        const key = normalizeTauriKey(event.payload);
        if (key) engine.handleKey(key);
      });
      const offTray = await listen("tray-toggle", async () => {
        const next = { ...engine.getSettings(), enabled: !engine.getSettings().enabled };
        engine.setSettings(next);
        await localStorageStore.save(next);
        window.dispatchEvent(new StorageEvent("storage", { key: "animalize_settings_v2", newValue: JSON.stringify(next) }));
      });
      unlisteners.push(offKey, offTray);
      if (cancelled) unlisteners.forEach((u) => u());
    });
    return () => {
      cancelled = true;
      unlisteners.forEach((u) => u());
    };
  }, [engine]);

  return (
    <main className="min-h-screen">
      <VoiceStudio engine={engine} store={localStorageStore} platform="desktop" extra={<PermissionBanner />} />
    </main>
  );
}
