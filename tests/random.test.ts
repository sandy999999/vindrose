import { describe, it, expect } from 'vitest'
import { fnv1a, mulberry32 } from '../src/lib/domain/random'

describe('fnv1a', () => {
  it('is deterministic and unsigned', () => {
    expect(fnv1a('58.110,11.320')).toBe(fnv1a('58.110,11.320'))
    expect(fnv1a('58.110,11.320')).toBeGreaterThanOrEqual(0)
    expect(fnv1a('a')).not.toBe(fnv1a('b'))
  })
})

describe('mulberry32', () => {
  it('repeats for the same seed and stays in range', () => {
    const a = mulberry32(7)
    const b = mulberry32(7)
    const first = [a(), a(), a()]
    expect([b(), b(), b()]).toEqual(first)
    for (const value of first) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })
})
