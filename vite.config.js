import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      // CRITICAL FIX: Explicitly ignore 'lucide-react' during the build process
      external: ['lucide-react']
    }
  }
});