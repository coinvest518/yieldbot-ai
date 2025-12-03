import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'import.meta.env.VITE_REOWN_PROJECT_ID': JSON.stringify(env.VITE_REOWN_PROJECT_ID || 'cd2c15a170750ad01e62ef80f2ba74f4'),
        // ElizaOS standardized naming - GOOGLE_GENERATIVE_AI_API_KEY
        'import.meta.env.VITE_GOOGLE_GENERATIVE_AI_API_KEY': JSON.stringify(env.VITE_GOOGLE_GENERATIVE_AI_API_KEY || env.GOOGLE_GENERATIVE_AI_API_KEY),
        'process.env.GOOGLE_GENERATIVE_AI_API_KEY': JSON.stringify(env.VITE_GOOGLE_GENERATIVE_AI_API_KEY || env.GOOGLE_GENERATIVE_AI_API_KEY),
        // Legacy support
        'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(env.VITE_GOOGLE_GENERATIVE_AI_API_KEY || env.GOOGLE_GENERATIVE_AI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
