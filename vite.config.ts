/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Publicado en GitHub Pages bajo /sinnube/
  base: process.env.GITHUB_PAGES ? '/sinnube/' : '/',
  plugins: [react()],
  test: { environment: 'node' },
});
