import { defineConfig } from 'vite';

export default defineConfig({
  base: '/oracle-de-choc/',
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  worker: {
    format: 'es',
  },
});
