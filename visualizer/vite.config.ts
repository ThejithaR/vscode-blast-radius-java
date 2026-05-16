// TODO(Member 5): Vite config. Plugin: @vitejs/plugin-react. build.outDir = 'dist'. base = './' for relative asset paths inside the VS Code webview.
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});
