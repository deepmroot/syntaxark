import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('@monaco-editor') || id.includes('monaco-editor')) return 'vendor-monaco'
          if (id.includes('yjs') || id.includes('y-monaco') || id.includes('y-webrtc') || id.includes('lib0')) return 'vendor-collab'
          if (id.includes('convex') || id.includes('@convex-dev/auth')) return 'vendor-convex'
          if (id.includes('react') || id.includes('scheduler')) return 'vendor-react'
        },
      },
    },
  },
})
