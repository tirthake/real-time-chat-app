import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      // FIX: Mark 'lucide-react' as external to avoid module conflicts 
      // when mixing with CDN imports in the runtime environment.
      external: [
        'lucide-react'
      ]
    },
    // Ensure all modules are outputted in a way that works with Vercel/dynamic imports
    target: 'esnext'
  },
  // Set host to '0.0.0.0' for development environment compatibility
  server: {
    host: '0.0.0.0'
  }
});