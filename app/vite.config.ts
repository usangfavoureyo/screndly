
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [tailwindcss(), react()],
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
    alias: {
      'vaul@1.1.2': 'vaul',
      'sonner@2.0.3': 'sonner',
      'recharts@2.15.2': 'recharts',
      'react-resizable-panels@2.1.7': 'react-resizable-panels',
      'react-hook-form@7.55.0': 'react-hook-form',
      'react-day-picker@8.10.1': 'react-day-picker',
      'lucide-react@0.487.0': 'lucide-react',
      'input-otp@1.4.2': 'input-otp',
      'figma:asset/f750bab317fb32b384968d2cc87ba7aa0347d7a8.png': path.resolve(__dirname, './src/assets/f750bab317fb32b384968d2cc87ba7aa0347d7a8.png'),
      'figma:asset/aa914b18f567f6825fda46e6657ced11e5c34887.png': path.resolve(__dirname, './src/assets/aa914b18f567f6825fda46e6657ced11e5c34887.png'),
      'figma:asset/651cd3122e66a0a82c96100f90fea6f2cdcb8b1c.png': path.resolve(__dirname, './src/assets/651cd3122e66a0a82c96100f90fea6f2cdcb8b1c.png'),
      'figma:asset/4befd8c03a67f3889be83b77f34eb6ea0d3f36d2.png': path.resolve(__dirname, './src/assets/4befd8c03a67f3889be83b77f34eb6ea0d3f36d2.png'),
      'figma:asset/3d1e1f7055aa9c1d56a2ffda020e0837ff1fbb2c.png': path.resolve(__dirname, './src/assets/3d1e1f7055aa9c1d56a2ffda020e0837ff1fbb2c.png'),
      'embla-carousel-react@8.6.0': 'embla-carousel-react',
      'date-fns@4.1.0': 'date-fns',
      'cmdk@1.1.1': 'cmdk',
      'class-variance-authority@0.7.1': 'class-variance-authority',
      '@radix-ui/react-tooltip@1.1.8': '@radix-ui/react-tooltip',
      '@radix-ui/react-toggle@1.1.2': '@radix-ui/react-toggle',
      '@radix-ui/react-toggle-group@1.1.2': '@radix-ui/react-toggle-group',
      '@radix-ui/react-tabs@1.1.3': '@radix-ui/react-tabs',
      '@radix-ui/react-switch@1.1.3': '@radix-ui/react-switch',
      '@radix-ui/react-slot@1.1.2': '@radix-ui/react-slot',
      '@radix-ui/react-slider@1.2.3': '@radix-ui/react-slider',
      '@radix-ui/react-separator@1.1.2': '@radix-ui/react-separator',
      '@radix-ui/react-select@2.1.6': '@radix-ui/react-select',
      '@radix-ui/react-scroll-area@1.2.3': '@radix-ui/react-scroll-area',
      '@radix-ui/react-radio-group@1.2.3': '@radix-ui/react-radio-group',
      '@radix-ui/react-progress@1.1.2': '@radix-ui/react-progress',
      '@radix-ui/react-popover@1.1.6': '@radix-ui/react-popover',
      '@radix-ui/react-navigation-menu@1.2.5': '@radix-ui/react-navigation-menu',
      '@radix-ui/react-menubar@1.1.6': '@radix-ui/react-menubar',
      '@radix-ui/react-label@2.1.2': '@radix-ui/react-label',
      '@radix-ui/react-hover-card@1.1.6': '@radix-ui/react-hover-card',
      '@radix-ui/react-dropdown-menu@2.1.6': '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-dialog@1.1.6': '@radix-ui/react-dialog',
      '@radix-ui/react-context-menu@2.2.6': '@radix-ui/react-context-menu',
      '@radix-ui/react-collapsible@1.1.3': '@radix-ui/react-collapsible',
      '@radix-ui/react-checkbox@1.1.4': '@radix-ui/react-checkbox',
      '@radix-ui/react-avatar@1.1.3': '@radix-ui/react-avatar',
      '@radix-ui/react-aspect-ratio@1.1.2': '@radix-ui/react-aspect-ratio',
      '@radix-ui/react-alert-dialog@1.1.6': '@radix-ui/react-alert-dialog',
      '@radix-ui/react-accordion@1.2.3': '@radix-ui/react-accordion',
      '@': path.resolve(__dirname, './src'),
    },
  },
  publicDir: 'src/public',
  build: {
    target: 'esnext',
    outDir: 'build',
    // CSS Optimization
    cssCodeSplit: true, // Split CSS per route for faster loading

  },
  server: {
    port: 5173,
    open: true,
  },
});