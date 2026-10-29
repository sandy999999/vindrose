import { describe, it, expect } from 'vitest'
import { CHANNELS } from '../src/lib/audio/engine'
import { TIMBRES, defaultTimbre, isTimbre } from '../src/lib/audio/timbres'

describe('timbre table', () => {
  it('gives every channel exactly three timbres with unique names', () => {
    for (const id of CHANNELS) {
      const options = TIMBRES[id]
      expect(options).toHaveLength(3)
      const names = options.map((option) => option.name)
      expect(new Set(names).size).toBe(3)
      for (const option of options) {
        expect(option.label.length).toBeGreaterThan(0)
      }
    }
  })

  it('uses the first entry as the default', () => {
    for (const id of CHANNELS) {
      expect(defaultTimbre(id)).toBe(TIMBRES[id][0]?.name)
    }
  })

  it('rejects names outside the channel table', () => {
    expect(isTimbre('wind', 'hiss')).toBe(true)
    expect(isTimbre('wind', 'roar')).toBe(true)
    expect(isTimbre('wind', 'bell')).toBe(false)
    expect(isTimbre('wind', '')).toBe(false)
  })
})
