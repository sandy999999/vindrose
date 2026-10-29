import { describe, it, expect } from 'vitest'
import { clamp, norm, expSmooth } from '../src/lib/domain/units'

describe('units', () => {
  it('clamps to range', () => {
    expect(clamp(12, 0, 10)).toBe(10)
    expect(clamp(-3, 0, 10)).toBe(0)
    expect(clamp(4, 0, 10)).toBe(4)
  })

  it('normalises into 0 to 1 and clamps outside', () => {
    expect(norm(5, 0, 10)).toBeCloseTo(0.5)
    expect(norm(20, 0, 10)).toBe(1)
    expect(norm(-5, 0, 10)).toBe(0)
  })

  it('approaches the target exponentially', () => {
    expect(expSmooth(0, 10, 20, 20)).toBeCloseTo(6.3212, 3)
    expect(expSmooth(10, 10, 5, 20)).toBeCloseTo(10)
    expect(expSmooth(0, 10, 0, 20)).toBe(0)
  })
})
