import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      // FIX: Explicitly externalize these imports to prevent Vercel/Rollup build failures
      // that happen when using the /compat paths in App.jsx.
      external: [
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