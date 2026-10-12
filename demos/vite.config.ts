import { resolve } from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
    base: '/demos/',
    plugins: [react()],
    build: {
        outDir: resolve(import.meta.dirname, '../static/demos'),
        emptyOutDir: true,
        rollupOptions: {
            input: {
                'virtuoso-chat': resolve(import.meta.dirname, 'virtuoso-chat/index.html'),
                'map-editor': resolve(import.meta.dirname, 'map-editor/index.html'),
                'ai-qa-trust': resolve(import.meta.dirname, 'ai-qa-trust/index.html'),
            },
        },
    },
    server: { port: 5190 },
});
