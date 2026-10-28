import { test, expect } from 'vitest'
import { loudestChannel } from './mono.ts'

test('picks the channel that carries the sound (iPhone: the second one is silent)', () => {
  const sound = Float32Array.from({ length: 4800 }, (_, i) => 0.3 * Math.sin(i / 7))
  expect(loudestChannel([sound, new Float32Array(4800)])).toBe(0)
  expect(loudestChannel([new Float32Array(4800), sound])).toBe(1)
  expect(loudestChannel([sound])).toBe(0)
})
