import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "apple-touch-icon.png"],
      workbox: {
        // Never answer these navigations with index.html.
        navigateFallbackDenylist: [/^\/ingest/, /^\/sitemap\.xml$/],
      },
      manifest: {
        name: "BBM Marketplace",
        short_name: "BBM Marketplace",
        description: "BBM Marketplace",
        theme_color: "#ffffff",
        background_color: "#000000",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
  // Local dev only: mirrors the /ingest rewrites in vercel.json. Order matters (specific first).
  server: {
    proxy: {
      "/ingest/static": {
        target: "https://us-assets.i.posthog.com",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/ingest/, ""),
      },
      "/ingest/array": {
        target: "https://us-assets.i.posthog.com",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/ingest/, ""),
      },
      "/ingest": {
        target: "https://us.i.posthog.com",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/ingest/, ""),
      },
    },
  },
});