import React from "react";
import ReactDOM from "react-dom/client";

import { VoiceEngine } from "@/engine";
import VoiceStudio from "@/app/VoiceStudio";
import { chromeStore } from "./chromeStore";
import { createChromeStorageClipStore } from "./chromeClipStore";
import "@/index.css";

const engine = new VoiceEngine({
  assetBase: chrome.runtime.getURL("").replace(/\/$/, ""),
  clipStore: createChromeStorageClipStore(),
  bankBase: chrome.runtime.getURL("banks"),
});
(window as Window & { __animalizeEngine?: VoiceEngine }).__animalizeEngine = engine;

const note = (
  <p className="rounded-xl bg-secondary px-4 py-3 text-sm leading-relaxed">
    웹페이지에서 타자를 치면 이 목소리가 나와요. 비밀번호 칸에서는 소리가 나지 않아요.
  </p>
);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <VoiceStudio engine={engine} store={chromeStore} platform="extension" extra={note} />
  </React.StrictMode>,
);
