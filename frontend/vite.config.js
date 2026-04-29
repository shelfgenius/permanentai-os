import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    dedupe: ['three', '@react-three/fiber', '@react-three/drei'],
  },
  optimizeDeps: {
    include: ['three', '@react-three/fiber'],
    exclude: ['@react-three/postprocessing'],
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          // Heavy 3D libs — cached separately, only loaded by Sky/Aura/Nexus/Mappy
          'vendor-three': ['three'],
          'vendor-r3f':   ['@react-three/fiber', '@react-three/drei'],
          // Animation libs
          'vendor-gsap':  ['gsap', 'gsap/ScrollTrigger'],
          'vendor-motion': ['framer-motion'],
          // React core
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
});
