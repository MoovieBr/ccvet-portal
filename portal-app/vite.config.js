import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// O portal é servido em /portal pelo Firebase Hosting, e o build escreve
// direto na pasta publicada (public/portal), que fica fora do versionamento.
export default defineConfig({
  plugins: [react()],
  base: "/portal/",
  build: {
    outDir: "../public/portal",
    emptyOutDir: true,
  },
});
