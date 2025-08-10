import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@/shared': path.resolve(__dirname, 'src/shared'),
      '@/components': path.resolve(__dirname, 'src/renderer/components'),
      '@/stores': path.resolve(__dirname, 'src/renderer/stores'),
      '@/hooks': path.resolve(__dirname, 'src/renderer/hooks'),
      '@/utils': path.resolve(__dirname, 'src/renderer/utils'),
    }
  },
  server: {
    port: 3000,
    open: true,
  }
})