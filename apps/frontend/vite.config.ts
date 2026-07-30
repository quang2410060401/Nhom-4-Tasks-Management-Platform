import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), tailwindcss(), tsconfigPaths()],
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }

          const packagePath = id.split('node_modules/').pop();
          if (!packagePath) {
            return 'vendor';
          }

          const packageParts = packagePath.split('/');
          const packageName = packageParts[0]?.startsWith('@')
            ? `${packageParts[0]}/${packageParts[1]}`
            : packageParts[0];

          if (!packageName) {
            return 'vendor';
          }

          const packageChunkAliases: Record<string, string> = {
            'react-router-dom': 'vendor-react-router',
            'react-router': 'vendor-react-router',
            cookie: 'vendor-axios',
            'set-cookie-parser': 'vendor-axios',
            'is-mobile': 'vendor-antd',
            'string-convert': 'vendor-antd',
            json2mq: 'vendor-antd',
            '@rc-component/mini-decimal': 'vendor-antd',
          };

          const aliasedChunk = packageChunkAliases[packageName];
          if (aliasedChunk) {
            return aliasedChunk;
          }

          return `vendor-${packageName.replace('@', '').replace('/', '-')}`;
        },
      },
    },
  },
});
