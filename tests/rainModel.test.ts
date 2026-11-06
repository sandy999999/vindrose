import { describe, it, expect } from 'vitest'
import {
  dropRate,
  dropTone,
  hissLevel,
  sampleDiameter,
  terminalVelocity,
} from '../src/lib/audio/rainModel'

describe('terminalVelocity', () => {
  it('matches the atlas curve for known drop sizes', () => {
    expect(terminalVelocity(1)).toBeCloseTo(4.0, 1)
    expect(terminalVelocity(4)).toBeGreaterThan(8)
    expect(terminalVelocity(0.5)).toBeLessThan(3)
  })
})

describe('sampleDiameter', () => {
  it('draws from the Marshall-Palmer distribution, larger drops in heavier rain', () => {
    const mean = (rate: number): number => {
      let sum = 0
      const n = 2000
      for (let i = 0; i < n; i += 1) sum += sampleDiameter(rate, (i + 0.5) / n)
      return sum / n
    }
    const drizzle = mean(0.5)
    const downpour = mean(10)
    expect(drizzle).toBeGreaterThan(0)
    expect(drizzle).toBeLessThan(1)
    expect(downpour).toBeGreaterThan(drizzle * 1.3)
  })

  it('never returns a drop outside the modelled range', () => {
    for (const u of [0, 0.001, 0.5, 0.999, 1]) {
      const diameter = sampleDiameter(2, u)
      expect(diameter).toBeGreaterThanOrEqual(0.1)
      expect(diameter).toBeLessThanOrEqual(8)
    }
  })
})

describe('dropRate', () => {
  it('grows with rain rate and is silent when dry', () => {
    expect(dropRate(0)).toBe(0)
    const drizzle = dropRate(0.5)
    const rain = dropRate(2)
    const heavy = dropRate(10)
    expect(drizzle).toBeGreaterThan(0)
    expect(rain).toBeGreaterThan(drizzle)
    expect(heavy).toBeGreaterThan(rain)
  })

  it('keeps a light drizzle audible and a downpour bounded', () => {
    expect(dropRate(1.2)).toBeGreaterThan(4)
    expect(dropRate(10)).toBeLessThanOrEqual(40)
  })
})

describe('dropTone', () => {
  it('gives small drops a bright tick and large drops a low thud', () => {
    expect(dropTone(0.4)).toBeGreaterThan(dropTone(2))
    expect(dropTone(2)).toBeGreaterThan(dropTone(6))
    expect(dropTone(0.1)).toBeLessThanOrEqual(9000)
    expect(dropTone(8)).toBeGreaterThanOrEqual(300)
  })
})

describe('hissLevel', () => {
  it('stays silent below four mm per hour and rises with the downpour', () => {
    expect(hissLevel(0)).toBe(0)
    expect(hissLevel(4)).toBe(0)
    expect(hissLevel(8)).toBeGreaterThan(0)
    expect(hissLevel(10)).toBeGreaterThan(hissLevel(8))
  })
})
