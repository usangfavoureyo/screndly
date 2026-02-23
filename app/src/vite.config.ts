import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Define environment variables for client-side access
  define: {
    'import.meta.env.APP_PASSWORD': JSON.stringify(process.env.VITE_APP_PASSWORD || process.env.APP_PASSWORD),
  },
  // CRITICAL: Prevent Vite from optimizing/pre-bundling FFmpeg or WASM-related packages
  optimizeDeps: {
    exclude: [
      '@ffmpeg/ffmpeg',
      '@ffmpeg/util',
      'ffmpeg',
      'ffmpeg-core',
      'ffmpeg.wasm',
      'xlsx', // xlsx might contain WASM - lazy load only
    ],
  },
  // Explicitly disable headers that might cause CORS issues with external resources
  server: {
    headers: {},
    fs: {
      // Deny access to WASM files during development
      deny: ['.wasm'],
    },
  },
  build: {
    // Optimize bundle size
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'motion-vendor': ['motion'],
          'chart-vendor': ['recharts'],
          'ui-components': [
            './components/ui/button.tsx',
            './components/ui/card.tsx',
            './components/ui/input.tsx',
            './components/ui/label.tsx',
            './components/ui/select.tsx',
            './components/ui/textarea.tsx',
          ],
          'contexts': [
            './contexts/NotificationsContext.tsx',
            './contexts/SettingsContext.tsx',
            './contexts/ThemeProvider.tsx',
          ],
          'utils': [
            './utils/haptics.ts',
            './utils/validators.ts',
          ],
        },
      },
      // Prevent bundling WASM files
      external: (id) => {
        return id.includes('.wasm') || 
               id.includes('ffmpeg') || 
               id.includes('@ffmpeg');
      },
    },
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 1000,
    // Minify for production
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.logs in production
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug'],
        passes: 2, // Run compression twice for better results
      },
      mangle: {
        safari10: true, // Fix Safari 10/11 bugs
      },
    },
    // Enable source maps for production debugging (without exposing source)
    sourcemap: 'hidden',
    // Optimize CSS
    cssCodeSplit: true,
    cssMinify: true,
    // Asset inlining threshold (10kb)
    assetsInlineLimit: 10240,
  },
});