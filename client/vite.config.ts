import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8001',
        changeOrigin: true
      },
      '/uploads': {
        target: 'http://localhost:8001',
        changeOrigin: true
      },
      '/storage': {
        target: 'http://localhost:8001',
        changeOrigin: true
      }
    }
  },
  build: {
    target: 'esnext',
    cssCodeSplit: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') || id.includes('node_modules/scheduler/')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/html2canvas')) {
            return 'vendor-canvas';
          }
          if (id.includes('node_modules/dompurify')) {
            return 'vendor-purify';
          }
        }
      }
    }
  }
});
