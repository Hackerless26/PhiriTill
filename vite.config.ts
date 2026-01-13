import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  appType: "spa",
  assetsInclude: ["**/*.html"],
  server: {
    port: 5174,
    strictPort: true,
    proxy: {
      "/.netlify/functions": {
        target: "http://localhost:8888",
        changeOrigin: true,
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg", "maskable-icon.svg"],
      manifest: {
        name: "PoxPOS",
        short_name: "PoxPOS",
        description: "Mobile-first POS and inventory system.",
        theme_color: "#0f3d2e",
        background_color: "#f6f5ef",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "/icon.svg",
            sizes: "any",
            type: "image/svg+xml",
          },
          {
            src: "/maskable-icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
});
