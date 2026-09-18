import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: false
      }
    }
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts']
  }
});
