import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // 
  // --- FIX START ---
  //
  build: {
    rollupOptions: {
      // This tells Vercel's bundler to handle the Firebase imports 
      // correctly during the production build.
      external: [
        'firebase/app',
        'firebase/auth',
        'firebase/firestore',
        // Add any other Firebase modules you might use in the future
      ],
    },
  },
  // 
  // --- FIX END ---
  //
})