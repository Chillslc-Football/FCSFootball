import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Absolute asset URLs so deep links like /suggestions/:id load JS/CSS from root.
  base: '/',
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
  publicDir: 'public',
});
