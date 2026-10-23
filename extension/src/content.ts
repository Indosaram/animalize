import { VoiceEngine, textToSoundKeys } from "@/engine";
import { chromeStore } from "./chromeStore";
import { createChromeStorageClipStore } from "./chromeClipStore";

const assetBase = chrome.runtime.getURL("").replace(/\/$/, "");
const engine = new VoiceEngine({ assetBase, clipStore: createChromeStorageClipStore() });
const root = document.documentElement;

const publish = () => {
  root.dataset.animalizePlays = String(engine.playCount);
};

void chromeStore.load().then((s) => engine.setSettings(s));
chromeStore.subscribe?.((s) => engine.setSettings(s));

const PLAIN_KEYS = new Set(["Enter", "Backspace", "Delete", "Tab", "Escape", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]);

function isPassword(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement && target.type === "password";
}

document.addEventListener(
  "keydown",
  (e) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || isPassword(e.target)) return;
    if (e.isComposing || e.key === "Process") return;
    if (e.key.length !== 1 && !PLAIN_KEYS.has(e.key)) return;
    engine.handleKey(e.key === " " ? "Space" : e.key);
    publish();
  },
  { capture: true, passive: true },
);

document.addEventListener(
  "input",
  (e) => {
    const ev = e as InputEvent;
    if (!ev.isComposing || !ev.data || isPassword(ev.target)) return;
    const keys = textToSoundKeys(ev.data.slice(-1));
    const last = keys[keys.length - 1];
    if (last) {
      engine.handleKey(last);
      publish();
    }
  },
  { capture: true, passive: true },
);

publish();
