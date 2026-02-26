import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import netlify from '@astrojs/netlify';
import clerk from '@clerk/astro';

export default defineConfig({
  output: 'server',
  adapter: netlify(),
  integrations: [react(), clerk()],
  vite: {
    resolve: {
      alias: {
        '@': new URL('./src', import.meta.url).pathname
      }
    },
    test: {
      environment: 'node',
      include: ['tests/**/*.test.ts']
    }
  }
});
