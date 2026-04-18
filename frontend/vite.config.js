import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Explicitly point to the module distribution to fix resolution failures in Rolldown/Vite 6+
      'emoji-mart': resolve(__dirname, 'node_modules/emoji-mart/dist/module.js'),
    },
  },
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react')) return 'vendor-react';
            if (id.includes('lucide-react') || id.includes('react-icons')) return 'vendor-ui-icons';
            if (id.includes('emoji-mart')) return 'vendor-emoji';
            if (id.includes('tweetnacl') || id.includes('socket.io')) return 'vendor-core';
            return 'vendor'; // all other deps
          }
        }
      }
    }
  }
})
