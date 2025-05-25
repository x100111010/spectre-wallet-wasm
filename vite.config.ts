import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [],
      },
    }),
    {
      name: "markdown-loader",
      transform(code, id) {
        if (id.slice(-3) === ".md") {
          // For .md files, get the raw content
          return `export default ${JSON.stringify(code)};`;
        }
      },
    },
  ],
  resolve: {
    alias: {
      'spectre-wasm': path.resolve(__dirname, './wasm/spectre-wasm/spectre.js')
    }
  },
  assetsInclude: ["**/*.md", "**/*.wasm"],
  build: {
    outDir: "build",
  },
  esbuild: {
    keepNames: true,
  },
  optimizeDeps: {
    exclude: ['spectre-wasm']
  }
});
