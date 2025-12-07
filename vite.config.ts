import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          '/api/moralis': {
            target: 'https://deep-index.moralis.io',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api\/moralis/, '/api/v2.2'),
            configure: (proxy, options) => {
              proxy.on('proxyReq', (proxyReq, req, res) => {
                // Add the API key header
                const apiKey = env.VITE_MORALIS_KEY;
                if (apiKey) {
                  proxyReq.setHeader('X-API-Key', apiKey);
                  proxyReq.setHeader('accept', 'application/json');
                } else {
                  console.warn('No Moralis API key found in environment');
                }
              });
            }
          }
        }
      },
      plugins: [react()],
      define: {
        'import.meta.env.VITE_REOWN_PROJECT_ID': JSON.stringify(env.VITE_REOWN_PROJECT_ID || 'cd2c15a170750ad01e62ef80f2ba74f4'),
        // ElizaOS standardized naming - GOOGLE_GENERATIVE_AI_API_KEY
        'import.meta.env.VITE_GOOGLE_GENERATIVE_AI_API_KEY': JSON.stringify(env.VITE_GOOGLE_GENERATIVE_AI_API_KEY || env.GOOGLE_GENERATIVE_AI_API_KEY),
        'process.env.GOOGLE_GENERATIVE_AI_API_KEY': JSON.stringify(env.VITE_GOOGLE_GENERATIVE_AI_API_KEY || env.GOOGLE_GENERATIVE_AI_API_KEY),
        // Legacy support
        'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(env.VITE_GOOGLE_GENERATIVE_AI_API_KEY || env.GOOGLE_GENERATIVE_AI_API_KEY),
        // Provide global fetch for cross-fetch compatibility
        global: 'globalThis'
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
          'cross-fetch': 'cross-fetch/dist/browser-ponyfill.js',
          'eventemitter2': 'eventemitter2/lib/eventemitter2.js',
          'socket.io-client': 'socket.io-client/dist/socket.io.js'
        }
      }
    };
});
