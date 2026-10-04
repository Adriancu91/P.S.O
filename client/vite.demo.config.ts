import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist-demo', rollupOptions: { input: 'demo.html' }, modulePreload: false, assetsInlineLimit: 100000000, cssCodeSplit: false },
});
