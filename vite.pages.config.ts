import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { copyFile, mkdir } from "node:fs/promises";

const pageAssets = [".nojekyll", "icon-1024.png", "manifest.webmanifest", "og-adaptive.png", "questions.json", "selector.js", "service-worker.js"];

export default defineConfig({
  base: "./",
  publicDir: false,
  plugins: [
    react(),
    {
      name: "roadwise-pages-assets",
      async closeBundle() {
        await mkdir("docs", { recursive: true });
        await Promise.all(pageAssets.map((file) => copyFile(`public/${file}`, `docs/${file}`)));
      },
    },
  ],
  build: {
    outDir: "docs",
    emptyOutDir: true,
  },
});
