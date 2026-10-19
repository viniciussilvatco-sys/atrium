/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// No GitHub Pages o app fica em https://<usuario>.github.io/<repositorio>/,
// então o workflow define BASE_PATH="/<repositorio>/". Localmente é "/".
const base = process.env.BASE_PATH || "/";

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/icon.svg"],
      manifest: {
        name: "Atrium",
        short_name: "Atrium",
        description: "Seu caderno de anotações com perfis e sincronização no Google Drive",
        lang: "pt-BR",
        theme_color: "#191919",
        background_color: "#191919",
        display: "standalone",
        start_url: base,
        scope: base,
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          { src: "icons/icon.svg", sizes: "any", type: "image/svg+xml" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff,woff2}"],
        maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
        navigateFallbackDenylist: [/^\/__/],
      },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 4000,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
