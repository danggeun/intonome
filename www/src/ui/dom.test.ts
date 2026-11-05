import { describe, test, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { glyphSvg } from './dom.ts'

/** 경로의 테두리 상자 — 이 글리프가 쓰는 명령(M · L · l · c · Z)만, 곡선은 촘촘히 짚어서 */
function bbox(d: string): [number, number, number, number] {
  const tok = d.match(/[A-Za-z]|-?\d*\.?\d+/g)!
  let i = 0, cmd = '', x = 0, y = 0
  const xs: number[] = [], ys: number[] = [], pt = (a: number, b: number) => { xs.push(a); ys.push(b) }
  const at = (k: number): string => tok[k] ?? '', num = () => parseFloat(at(i++))
  while (i < tok.length) {
    if (/[A-Za-z]/.test(at(i))) cmd = at(i++)
    if (cmd === 'Z') continue
    if (cmd === 'M' || cmd === 'L') { x = num(); y = num(); pt(x, y) }
    else if (cmd === 'l') { x += num(); y += num(); pt(x, y) }
    else if (cmd === 'c') {
      const x1 = x + num(), y1 = y + num(), x2 = x + num(), y2 = y + num(), x3 = x + num(), y3 = y + num()
      for (let k = 0; k <= 100; k++) { const t = k / 100, u = 1 - t; pt(u*u*u*x + 3*u*u*t*x1 + 3*u*t*t*x2 + t*t*t*x3, u*u*u*y + 3*u*u*t*y1 + 3*u*t*t*y2 + t*t*t*y3) }
      x = x3; y = y3
    } else throw new Error('unexpected ' + cmd)
  }
  return [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
}
const playPath = glyphSvg('play').match(/d="([^"]+)"/)?.[1] ?? ''

describe('play glyph ▶', () => {
  test('vertically centred on the 24-unit box (2.9.0 sat 0.25 units high)', () => {
    const [, , y0, y1] = bbox(playPath)
    expect(Math.abs((y0 + y1) / 2 - 12)).toBeLessThan(0.02)
  })
  test('horizontally the box sits 1.5 units right — optical centre for a triangle', () => {
    const [x0, x1] = bbox(playPath)
    expect((x0 + x1) / 2 - 12).toBeCloseTo(1.5, 1)
  })
  test('the static copies in index.html are the same path', () => {
    const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')
    const paths = [...html.matchAll(/data-glyph="play"><svg[^>]*><path d="([^"]+)"/g)].map(m => m[1] ?? '')
    expect(paths.length).toBe(3)
    for (const p of paths) expect(p).toBe(playPath)
  })
})
