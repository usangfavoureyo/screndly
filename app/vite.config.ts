import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [tailwindcss(), react()],
  define: {
    __APP_BUILD_ID__: JSON.stringify(new Date().toISOString()),
  },
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(__dirname, "./src") },
      { find: "@lucide-real", replacement: path.resolve(__dirname, "./node_modules/lucide-react/dist/esm/lucide-react.js") },
      { find: /^lucide-react$/, replacement: path.resolve(__dirname, "./src/lib/icons/lucide-compat.tsx") },
    ],
  },
  publicDir: 'src/public',
  build: {
    target: 'esnext',
    outDir: 'dist',
    // CSS Optimization
    cssCodeSplit: true, // Split CSS per route for faster loading
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, '/');

          if (!normalizedId.includes('/node_modules/')) {
            return undefined;
          }

          if (normalizedId.includes('/xlsx/')) {
            return 'vendor-spreadsheet';
          }

          if (normalizedId.includes('/recharts/')) {
            return 'vendor-charts';
          }

          if (
            normalizedId.includes('/react-hook-form/') ||
            normalizedId.includes('/input-otp/')
          ) {
            return 'vendor-forms';
          }

          if (
            normalizedId.includes('/date-fns/') ||
            normalizedId.includes('/react-day-picker/')
          ) {
            return 'vendor-dates';
          }

          if (normalizedId.includes('/lucide-react/')) {
            return 'vendor-icons';
          }

          if (
            normalizedId.includes('/@radix-ui/') ||
            normalizedId.includes('/@floating-ui/') ||
            normalizedId.includes('/react-remove-scroll/') ||
            normalizedId.includes('/aria-hidden/') ||
            normalizedId.includes('/use-callback-ref/')
          ) {
            return 'vendor-radix';
          }

          if (
            normalizedId.includes('/vaul/') ||
            normalizedId.includes('/cmdk/') ||
            normalizedId.includes('/embla-carousel-react/') ||
            normalizedId.includes('/embla-carousel/') ||
            normalizedId.includes('/react-resizable-panels/')
          ) {
            return 'vendor-ui-shell';
          }

          if (normalizedId.includes('/zustand/')) {
            return 'vendor-state';
          }

          if (normalizedId.includes('/sonner/')) {
            return 'vendor-feedback';
          }

          return 'vendor';
        },
      },
    },
  },
  server: {
    port: 5173,
    open: true,
  },
});
