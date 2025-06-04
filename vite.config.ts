import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import inject from '@rollup/plugin-inject';

export default defineConfig({
  plugins: [
    react(),
    inject({
      Buffer: ['buffer', 'Buffer'], // Inject Buffer polyfill
    }),
  ],
  define: {
    global: 'window', // Needed for some Solana libraries
  },
  optimizeDeps: {
    include: ['buffer'], // Ensures `buffer` is available in dev
  },
  server: {
    port: 5174, // Your desired port
  },
});
