import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      external: [
        // Include the new /compat paths to prevent Rollup errors
        'firebase/app/compat',
        'firebase/auth/compat',
        'firebase/app',
        'firebase/auth',
        'firebase/firestore',
        'lucide-react'
      ],
    },
  },
});