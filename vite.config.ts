import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import inject from '@rollup/plugin-inject';

export default defineConfig({
  plugins: [
    react(),
    inject({
      Buffer: ['buffer', 'Buffer'],
    }),
  ],
  define: {
    global: 'window',
  },
  optimizeDeps: {
    include: ['buffer'],
  },
  server: {
    port: 5174,
    // amazonq-ignore-next-line
    host: '0.0.0.0',         // 🔑 required for external tunnel access
    allowedHosts: true      // 🔑 make sure it's NOT in []
  },
});
