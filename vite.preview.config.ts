import { defineConfig, mergeConfig } from 'vite'
import base from './vite.config.ts'

// One-file demo build: everything, including code that is normally loaded on demand,
// goes into a single script so scripts/make-preview.mjs can inline it.
export default mergeConfig(
  base,
  defineConfig({
    build: {
      outDir: 'dist-preview',
      assetsInlineLimit: 100000000,
      rollupOptions: { output: { inlineDynamicImports: true } },
    },
  }),
)
