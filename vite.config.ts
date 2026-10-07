import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  base: './',
  server: { host: '127.0.0.1', port: 5180, proxy: { '/api': 'http://127.0.0.1:8000' } },
  preview: { port: 5181, proxy: { '/api': 'http://127.0.0.1:8000' } },
});
