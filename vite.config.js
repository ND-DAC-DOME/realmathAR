import { defineConfig } from 'vite'

const REPO_NAME = '/realmathAR/'

export default defineConfig({
  base: `${REPO_NAME}`,
  build: {
    sourcemap: true,
  },
  css: {
    devSourceMap: true,
  },
  server: {
    allowedHosts: ['.ngrok-free.dev'],
  },
});
