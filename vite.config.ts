import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Determine base URL based on build target
// Set VITE_BASE_URL environment variable for different platforms:
// - GitHub Pages: VITE_BASE_URL=/reelview-spa/
// - Electron/Capacitor: VITE_BASE_URL=./
const base = process.env.VITE_BASE_URL || './'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: false, // Disable minification for easier debugging
    sourcemap: true // Enable source maps for better stack traces
  },
  base,
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
