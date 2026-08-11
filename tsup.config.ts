import { readFileSync } from 'node:fs'
import { defineConfig } from 'tsup'

const pkg = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8')
) as { version: string }

export default defineConfig({
  entry: { bin: 'src/bin.ts' },
  format: ['esm'],
  target: 'es2022',
  platform: 'node',
  sourcemap: true,
  clean: true,
  treeshake: true,
  splitting: false,
  banner: { js: '#!/usr/bin/env node' },
  define: { __CLI_VERSION__: JSON.stringify(pkg.version) },
})
