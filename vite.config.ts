import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const baseFromEnv = process.env.BASE_PATH || "/";

export default defineConfig({
  plugins: [react()],
  base: baseFromEnv,
  build: {
    outDir: "dist"
  }
});
