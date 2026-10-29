import { describe, it, expect } from 'vitest'
import { clamp } from '../src/lib/domain/units'

describe('units', () => {
  it('clamps to range', () => {
    expect(clamp(12, 0, 10)).toBe(10)
  })
})
