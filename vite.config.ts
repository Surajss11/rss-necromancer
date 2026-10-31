/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE ?? '/rss-necromancer/',
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
    rollupOptions: {
      // Ensure we never emit the entire sql.js dist dump
      external: [],
    },
  },
  optimizeDeps: {
    exclude: ['sql.js'],
  },
  server: {
    fs: {
      // allow reading wasm from public only
      allow: ['.'],
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
