import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  resolve: {
    alias: {
      '@air-clash/common': resolve(__dirname, '../common/src'),
    },
  },
  server: {
    port: 5173,
    host: true, // Allow access from network
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
  },
});
