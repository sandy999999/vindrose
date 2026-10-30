import { describe, it, expect } from 'vitest'
import { airAbsorption, airShelfDb, speedOfSound, speedRatio } from '../src/lib/domain/air'

describe('speedOfSound', () => {
  it('matches the standard figures at common temperatures', () => {
    expect(speedOfSound(0)).toBeCloseTo(331.3, 0)
    expect(speedOfSound(20)).toBeCloseTo(343.2, 0)
    expect(speedOfSound(30)).toBeCloseTo(349.0, 0)
  })

  it('rises about two percent from freezing to a warm day', () => {
    expect(speedRatio(20)).toBeCloseTo(1, 5)
    expect(speedRatio(30) / speedRatio(-10)).toBeGreaterThan(1.05)
  })
})

describe('airAbsorption', () => {
  it('matches the ISO 9613-1 table at 20 C and 70 percent', () => {
    expect(airAbsorption(20, 70, 1000) * 1000).toBeCloseTo(5.4, 0)
    expect(airAbsorption(20, 70, 4000) * 1000).toBeCloseTo(24.0, 0)
    expect(airAbsorption(20, 70, 8000) * 1000).toBeCloseTo(78.5, 0)
  })

  it('absorbs highs more in cold air at the same relative humidity', () => {
    expect(airAbsorption(0, 70, 4000)).toBeGreaterThan(airAbsorption(20, 70, 4000))
  })

  it('rises with frequency', () => {
    const low = airAbsorption(20, 70, 500)
    const high = airAbsorption(20, 70, 4000)
    expect(high).toBeGreaterThan(low * 2)
  })
})

describe('airShelfDb', () => {
  it('turns absorption over a path into a non positive shelf', () => {
    const shelf = airShelfDb(20, 70, 100)
    expect(shelf).toBeLessThan(0)
    expect(shelf).toBeCloseTo(-2.4, 0)
  })

  it('never brightens and never exceeds the cap', () => {
    expect(airShelfDb(20, 70, 0)).toBe(0)
    expect(airShelfDb(60, 100, 10_000)).toBeGreaterThanOrEqual(-18)
  })
})
