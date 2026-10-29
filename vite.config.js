import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // 示範版用相對路徑，方便放在任何資料夾預覽；正式版維持根目錄
  base: process.env.VITE_DEMO === "1" ? "./" : "/",
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          supabase: ["@supabase/supabase-js"],
        },
      },
    },
  },
});
