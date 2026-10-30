import { describe, it, expect } from 'vitest'
import {
  bellAt, layerMask, maskAt, nextSeed, planFor, pieceLength, sectionAt, soloVoice, stormScore, thunderSlots,
} from '../src/lib/domain/director'
import { fnv1a } from '../src/lib/domain/random'
import type { WeatherReading } from '../src/lib/domain/types'

const calm: WeatherReading = {
  time: '2026-10-30T12:00', windSpeed: 2, windGust: 4, windDirection: 90,
  temperature: 8, humidity: 60, pressure: 1013, precipitation: 0,
  cloudCover: 20, weatherCode: 1,
}
const storm: WeatherReading = { ...calm, windSpeed: 22, windGust: 30, precipitation: 6, weatherCode: 65, pressure: 985 }

describe('stormScore', () => {
  it('scores a calm reading low and a storm high', () => {
    expect(stormScore(calm)).toBeLessThan(0.2)
    expect(stormScore(storm)).toBeGreaterThan(0.6)
  })

  it('scores null at the neutral midpoint', () => {
    expect(stormScore(null)).toBe(0.5)
  })

  it('does not let a storm code alone force a build', () => {
    expect(stormScore({ ...calm, weatherCode: 95 })).toBeLessThan(0.6)
  })
})

describe('pieceLength', () => {
  it('stays between 480 and 600 seconds and repeats per seed', () => {
    for (let seed = 0; seed < 50; seed += 1) {
      const length = pieceLength(seed)
      expect(length).toBeGreaterThanOrEqual(480)
      expect(length).toBeLessThanOrEqual(600)
      expect(pieceLength(seed)).toBe(length)
    }
  })
})

describe('planFor', () => {
  it('uses five sections at 8:30 and above and four below', () => {
    expect(pieceLength(30)).toBe(510)
    expect(planFor(30, storm).sections.length).toBe(5)
    expect(pieceLength(29)).toBe(509)
    expect(planFor(29, storm).sections.length).toBe(4)
  })

  it('always uses emerge, break, return in that order and covers the length', () => {
    for (let seed = 0; seed < 20; seed += 1) {
      const plan = planFor(seed, calm)
      const kinds = plan.sections.map((s) => s.kind)
      expect(kinds[0]).toBe('emerge')
      expect(kinds).toContain('break')
      expect(kinds[kinds.length - 1]).toBe('return')
      expect(plan.sections[0]?.startSec).toBe(0)
      expect(plan.sections[plan.sections.length - 1]?.endSec).toBe(plan.lengthSec)
    }
  })

  it('keeps every section inside its range', () => {
    const ranges: Record<string, [number, number]> = {
      emerge: [90, 150], build: [120, 180], expose: [90, 150], break: [45, 75], return: [90, 150],
    }
    for (const reading of [storm, calm, null]) {
      for (let seed = 0; seed < 121; seed += 1) {
        for (const section of planFor(seed, reading).sections) {
          const [lo, hi] = ranges[section.kind]!
          const length = section.endSec - section.startSec
          expect(length).toBeGreaterThanOrEqual(lo)
          expect(length).toBeLessThanOrEqual(hi)
        }
      }
    }
  })

  it('makes adjacent sections meet without a gap', () => {
    const plan = planFor(11, storm)
    for (let i = 1; i < plan.sections.length; i += 1) {
      expect(plan.sections[i]?.startSec).toBe(plan.sections[i - 1]?.endSec)
    }
  })

  it('picks the four-section middle from the score', () => {
    const seed = [...Array(50).keys()].find((s) => pieceLength(s) < 510)!
    expect(planFor(seed, storm).sections[1]?.kind).toBe('build')
    expect(planFor(seed, calm).sections[1]?.kind).toBe('emerge')
    const neutral = planFor(seed, null).sections[1]?.kind
    expect(neutral).toBe('expose')
  })
})

describe('masks and rare events', () => {
  it('picks a solo voice by the strongest normalised parameter', () => {
    expect(soloVoice(storm)).toBe('pressure')
    expect(soloVoice({ ...storm, pressure: 1013 })).toBe('gust')
    expect(soloVoice({ ...calm, windSpeed: 18, windGust: 20, precipitation: 0 })).toBe('wind')
    expect(soloVoice({ ...calm, precipitation: 9 })).toBe('rain')
    expect(soloVoice(null)).toBe('wind')
  })

  it('silences every other layer in expose', () => {
    const mask = layerMask('expose', 'rain')
    expect(mask.rain).toBe(1)
    expect(mask.pad).toBe(0)
    expect(mask.motif).toBeLessThanOrEqual(0.3)
  })

  it('leaves only wind in break and in its last six seconds', () => {
    const plan = planFor(2, calm)
    const span = plan.sections.find((s) => s.kind === 'break')!
    const early = maskAt(plan, span.startSec + 1)
    const end = maskAt(plan, span.endSec - 3)
    expect(end.wind).toBeGreaterThan(0)
    expect(Object.entries(end).filter(([id, v]) => id !== 'wind' && v > 0)).toEqual([])
    expect(early.pad).toBeGreaterThan(0)
  })

  it('puts the bell two seconds before break ends', () => {
    const plan = planFor(2, calm)
    const span = plan.sections.find((s) => s.kind === 'break')!
    expect(bellAt(plan)).toBe(span.endSec - 2)
  })

  it('puts thunder only in build or expose, at most every 90 seconds', () => {
    const plan = planFor(3, storm)
    const slots = thunderSlots(plan, { ...storm, weatherCode: 96 })
    expect(slots.length).toBeGreaterThanOrEqual(1)
    for (const t of slots) {
      const section = plan.sections.find((s) => t >= s.startSec && t < s.endSec)
      expect(['build', 'expose']).toContain(section?.kind)
    }
    for (let i = 1; i < slots.length; i += 1) {
      expect(slots[i]! - slots[i - 1]!).toBeGreaterThanOrEqual(90)
    }
    expect(thunderSlots(plan, calm)).toEqual([])
  })

  it('chains the next seed deterministically from the first', () => {
    expect(nextSeed(42, 1)).toBe(fnv1a('42:1'))
    expect(nextSeed(42, 2)).toBe(fnv1a('42:2'))
  })
})

describe('sectionAt', () => {
  it('names the section containing a moment', () => {
    const plan = planFor(30, storm)
    const expose = plan.sections.find((span) => span.kind === 'expose')!
    expect(sectionAt(plan, 0)).toBe('emerge')
    expect(sectionAt(plan, expose.startSec + 1)).toBe('expose')
    expect(sectionAt(plan, plan.lengthSec)).toBe('return')
  })
})
