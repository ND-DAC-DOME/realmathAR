import { defineConfig } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy';

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
