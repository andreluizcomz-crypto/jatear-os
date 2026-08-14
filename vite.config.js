import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // 3001 para nunca dividir o localhost:3000 com o LMS (que tem
    // service worker antigo registrado nessa origem servindo cache)
    port: 3001,
    strictPort: true,
  },
  build: {
    outDir: 'build',
  },
});
