import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Pruebas en Node con test/expect globales; '@' apunta a la raíz del repo, como en jsconfig.json.
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  test: { environment: 'node', globals: true },
});
