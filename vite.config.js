import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Rutas relativas al HTML: sirve en subcarpeta o dentro de iframe sin romper /images ni /data.
export default defineConfig({
  base: "./",
  plugins: [react()],
});
