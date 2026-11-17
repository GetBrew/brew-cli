#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { launch } from './launcher.mjs'

const { version } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8')
)
await launch({ packageName: 'create-brew', version })
