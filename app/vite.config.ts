import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  publicDir: 'src/public',
  build: {
    target: 'esnext',
    outDir: 'dist',
    // CSS Optimization
    cssCodeSplit: true, // Split CSS per route for faster loading

  },
  server: {
    port: 5173,
    open: true,
  },
});