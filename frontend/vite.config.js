import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: true, // Listen on all network interfaces
    allowedHosts: true, // Allow all hosts so localtunnel works
  },
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test/setup.js'],
  },
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
            // three.js + react-three-fiber/drei (Gamify Mode's 3D room) must
            // live in their OWN chunk, listed before the generic rules below:
            // '@react-three/fiber' contains "react" so it would otherwise be
            // swept into vendor-react, and three itself into the catch-all
            // 'vendor' — both are loaded on every page, which would make the
            // whole app pay for a feature only a few people open.
            if (/node_modules[\\/](three|@react-three|three-stdlib|react-reconciler|its-fine|suspend-react|maath|meshline|troika-[^\\/]+|three-mesh-bvh|camera-controls|detect-gpu|webgl-constants|stats-gl|zustand|tunnel-rat)[\\/]/.test(id)) return 'vendor-three';
            if (id.includes('react')) return 'vendor-react';
            if (id.includes('lucide-react') || id.includes('react-icons')) return 'vendor-ui-icons';
            if (id.includes('emoji-mart')) return 'vendor-emoji';
            if (id.includes('tweetnacl') || id.includes('socket.io')) return 'vendor-core';
            return 'vendor'; // all other deps
          }
          // Pinned explicitly rather than left to Rollup's automatic
          // chunking — that's a whole-graph heuristic, so adding an
          // unrelated new shared module elsewhere (lib/platform.js, lib/
          // nativeGoogleAuth.js, both newly shared between the eager main
          // entry and lazy Login/Signup chunks) shifted its decisions and
          // pulled these two previously-separate chunks into the main
          // eager bundle instead, adding ~340KB to every page's initial
          // load. GlobalChatWidget in particular is reachable both eagerly
          // (BottomNav, mounted app-wide in App.jsx) and lazily (Room.jsx),
          // which is exactly the shape Rollup's automatic splitter can flip
          // on when something unrelated elsewhere in the graph changes.
          if (id.includes('/contexts/CryptoContext')) return 'crypto-context';
          if (id.includes('/components/GlobalChatWidget')) return 'global-chat-widget';
        }
      }
    }
  }
})



