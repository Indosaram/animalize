import path from "node:path";
import { copyFileSync, cpSync, existsSync, mkdirSync } from "node:fs";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const root = __dirname;
const outDir = path.resolve(root, "extension/dist");
const target = process.env.EXT_TARGET === "content" ? "content" : "popup";

function copyStatic(): Plugin {
  return {
    name: "animalize-copy-static",
    closeBundle() {
      mkdirSync(outDir, { recursive: true });
      copyFileSync(path.resolve(root, "extension/manifest.json"), path.resolve(outDir, "manifest.json"));
      cpSync(path.resolve(root, "public/assets/audio"), path.resolve(outDir, "assets/audio"), { recursive: true });
      cpSync(path.resolve(root, "public/assets/images"), path.resolve(outDir, "assets/images"), { recursive: true });
      cpSync(path.resolve(root, "public/assets/fonts"), path.resolve(outDir, "assets/fonts"), { recursive: true });
      if (existsSync(path.resolve(root, "public/local-packs"))) {
        cpSync(path.resolve(root, "public/local-packs"), path.resolve(outDir, "local-packs"), { recursive: true });
      }
    },
  };
}

const alias = { "@": path.resolve(root, "src") };

export default defineConfig(
  target === "content"
    ? {
        resolve: { alias },
        publicDir: false,
        build: {
          outDir,
          emptyOutDir: false,
          lib: {
            entry: path.resolve(root, "extension/src/content.ts"),
            formats: ["iife"],
            name: "AnimalizeContent",
            fileName: () => "content.js",
          },
        },
      }
    : {
        root: path.resolve(root, "extension"),
        base: "./",
        publicDir: false,
        plugins: [react(), tailwindcss(), copyStatic()],
        resolve: { alias },
        build: {
          outDir,
          emptyOutDir: true,
          rollupOptions: { input: path.resolve(root, "extension/popup.html") },
        },
      },
);
