import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Porta exclusiva do Jatear OS. As origens localhost:3000 (LMS) e
    // localhost:3001 (tintas) têm service workers antigos registrados no
    // navegador que servem esses apps do cache mesmo sem servidor rodando.
    port: 3210,
    strictPort: true,
  },
  build: {
    outDir: 'build',
  },
});
