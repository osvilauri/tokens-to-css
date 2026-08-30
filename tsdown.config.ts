import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  dts: true,
  clean: true,
  treeshake: true,
  // `type: module` makes .js unambiguously ESM; the .mjs default would
  // contradict the exports map and ship a package that cannot resolve.
  fixedExtension: false,
})
