import { test, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// The e2e shards run in the Playwright image. Its browsers belong to one Playwright version:
// if the lock file moves on and the image tag does not, every shard fails with "Executable doesn't exist".
test('the CI Playwright image matches the locked playwright version', () => {
  const root = new URL('..', import.meta.url)
  const lock = JSON.parse(readFileSync(new URL('package-lock.json', root), 'utf8'))
  const ci = readFileSync(new URL('.github/workflows/ci.yml', root), 'utf8')
  const tags = [...ci.matchAll(/mcr\.microsoft\.com\/playwright:v([\d.]+)-/g)].map(m => m[1])
  expect(tags.length).toBeGreaterThan(0)
  for (const v of tags) expect(v).toBe(lock.packages['node_modules/playwright'].version)
})
