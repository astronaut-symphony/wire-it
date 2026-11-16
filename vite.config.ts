import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // "@/features/..." instead of "../../.."; keep in step with `paths` in tsconfig.json
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
});
