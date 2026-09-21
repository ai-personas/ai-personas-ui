import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
export default defineConfig({
  plugins: [preact()],
  // Prebundle worker dependencies in development so the first preview/upload
  // does not trigger a dependency-discovery full-page reload. The browser still
  // requests these modules only when their lazy renderer/worker is mounted.
  optimizeDeps: { include: ['hash-wasm', '@zip.js/zip.js/lib/zip-core-native.js', 'dompurify', 'marked'] },
  server: { proxy: { '/api': 'http://127.0.0.1:19000', '/health': 'http://127.0.0.1:19000' } },
  build: { sourcemap: true },
});
