import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import * as path from 'path';

export default defineConfig({
  root: 'solid-app',
  plugins: [solidPlugin()],
  build: {
    outDir: path.resolve(__dirname, 'dist-solid'),
    emptyOutDir: true,
    target: 'esnext'
  },
  server: {
    port: 5173
  }
});
