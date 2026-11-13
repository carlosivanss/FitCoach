import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// El panel es autocontenido: código, variables de entorno (.env.local), public/ y dist/ viven en web/.
export default defineConfig({
  plugins: [react()],
  publicDir: 'public',
  build: { outDir: 'dist', emptyOutDir: true },
  server: { port: 8082 },
});
