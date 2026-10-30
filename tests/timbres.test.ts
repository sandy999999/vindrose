import { describe, it, expect } from 'vitest'
import { TIMBRES, defaultTimbre, defaultTimbres, isTimbre } from '../src/lib/audio/timbres'

const MUSICAL = ['motif', 'pad'] as const

describe('timbre table', () => {
  it('gives pad and motif three timbres with unique names', () => {
    expect(Object.keys(TIMBRES).sort()).toEqual(['motif', 'pad'])
    for (const id of MUSICAL) {
      const options = TIMBRES[id]!
      expect(options).toHaveLength(3)
      const names = options.map((option) => option.name)
      expect(new Set(names).size).toBe(3)
      for (const option of options) {
        expect(option.label.length).toBeGreaterThan(0)
      }
    }
  })

  it('uses the first entry as the default', () => {
    for (const id of MUSICAL) {
      expect(defaultTimbre(id)).toBe(TIMBRES[id]?.[0]?.name)
    }
  })

  it('defaults only the two musical voices', () => {
    const defaults = defaultTimbres()
    expect(Object.keys(defaults).sort()).toEqual(['motif', 'pad'])
    expect(defaults.pad).toBe(defaultTimbre('pad'))
    expect(defaults.motif).toBe(defaultTimbre('motif'))
  })

  it('rejects names outside the channel table', () => {
    expect(isTimbre('pad', 'pad')).toBe(true)
    expect(isTimbre('pad', 'bell')).toBe(false)
    expect(isTimbre('motif', 'bell')).toBe(true)
    expect(isTimbre('wind', 'hiss')).toBe(false)
    expect(isTimbre('pad', '')).toBe(false)
  })
})
