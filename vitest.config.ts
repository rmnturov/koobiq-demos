import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // The published Angular theme uses extensionless ESM imports, which need Vite's resolver in Node tests.
        server: { deps: { inline: ['@koobiq/ag-grid-angular-theme'] } }
    }
});
