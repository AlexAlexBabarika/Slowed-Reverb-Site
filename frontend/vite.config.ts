import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => ({
  plugins: [sveltekit()],
  server: {
    proxy: {
      '/api': {
        target: loadEnv(mode, '.', 'SLOWED_REVERB_').SLOWED_REVERB_BACKEND_URL
          ?? 'http://127.0.0.1:8000',
        changeOrigin: false
      }
    }
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts']
  }
}));
