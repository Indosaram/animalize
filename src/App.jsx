import { useState, useEffect } from "react";
import reactLogo from "./assets/react.svg";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";
import { audioSystem } from "./utils/audioSystem";
import Settings from "./components/Settings";

function App() {
  useEffect(() => {
    // Global listener setup (Single Source of Truth)
    let unlisten = null;
    let canceled = false;

    import("@tauri-apps/api/event").then(({ listen }) => {
      listen("global-keydown", (event) => {
        console.log("Raw payload:", event.payload); 
        // Payload format: "KeyName,IsShift" (string)
        // e.g. "Space,false", "KeyA,true", "Slash,false"
        const parts = event.payload.split(',');
        let key = parts[0];
        const isShift = parts[1] === "true";

        // Skip modifier keys entirely
        if (key.startsWith("LShift") || key.startsWith("RShift") || 
            key.startsWith("LControl") || key.startsWith("RControl") ||
            key.startsWith("LAlt") || key.startsWith("RAlt") ||
            key.startsWith("LMeta") || key.startsWith("RMeta") ||
            key === "CapsLock") {
          return;
        }

        // Normalization
        if (key.length === 1) {
          // Already single char
        } else if (key.startsWith("Key")) {
          key = key.substring(3);
        } else if (key.startsWith("Num")) {
          key = key.substring(3);
        }

        // Punctuation & Special Keys Map
        const specialKeys = {
          "Return": "Enter",
          "Enter": "Enter",
          "Space": "Space",
          "Backspace": "Backspace",
          "Tab": "Tab",
          "Escape": "Escape",
          "Up": "ArrowUp",
          "Down": "ArrowDown",
          "Left": "ArrowLeft",
          "Right": "ArrowRight",
          "Delete": "Delete",

          // Punctuation (DeviceQuery names -> Real chars)
          "Minus": isShift ? "_" : "-",
          "Equal": isShift ? "+" : "=",
          "LeftBracket": isShift ? "{" : "[",
          "RightBracket": isShift ? "}" : "]",
          "BackSlash": isShift ? "|" : "\\",
          "Semicolon": isShift ? ":" : ";",
          "Apostrophe": isShift ? '"' : "'",
          "Comma": isShift ? "<" : ",",
          "Dot": isShift ? ">" : ".",
          "Slash": isShift ? "?" : "/",
          "Grave": isShift ? "~" : "`"
        };

        if (specialKeys[key]) {
          key = specialKeys[key];
        } else if (isShift && key.length === 1 && /[a-z0-9]/i.test(key)) {
          // Handle Shift+Number (e.g. Shift+1 -> !)
          const shiftNums = {
            "1": "!", "2": "@", "3": "#", "4": "$", "5": "%",
            "6": "^", "7": "&", "8": "*", "9": "(", "0": ")"
          };
          if (shiftNums[key]) key = shiftNums[key];
          else key = key.toUpperCase(); // Ensure letters are upper if simple shift
        }

        // Always play sound from global event to avoid duplication/race conditions
        audioSystem.handleInput(key, 0, true);

      }).then((u) => {
        unlisten = u;
        if (canceled) u(); // If cleanup happened before we got the unlisten function, call it now
      });
    });

    return () => {
      canceled = true;
      if (unlisten) unlisten();
    };
  }, []);

  return (
    <main className="container">
      <h1>Animalize</h1>
      <Settings />
    </main>
  );
}

export default App;
