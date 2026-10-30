import { describe, it, expect } from 'vitest'
import { placeProfile, fnv1a } from '../src/lib/domain/place'
import { MODES, snapHzToMode } from '../src/lib/domain/harmony'

describe('placeProfile', () => {
  it('derives everything but elevation from the coordinates', () => {
    const a = placeProfile(58.111, 11.321)
    const b = placeProfile(58.111, 11.321)
    expect(a).toEqual(b)
    expect(a.seed).toBe(fnv1a('58.111,11.321'))
    expect(a.tempo).toBe(48 + (a.seed % 17))
    expect(a.aperture).toBeCloseTo(0.002 + (a.seed % 5) * 0.001)
  })

  it('picks the mode by absolute latitude', () => {
    expect(placeProfile(10, 0).mode).toBe('lydian')
    expect(placeProfile(35, 0).mode).toBe('dorian')
    expect(placeProfile(58, 0).mode).toBe('aeolian')
    expect(placeProfile(64, 0).mode).toBe('phrygian')
    expect(placeProfile(-64, 0).mode).toBe('phrygian')
  })

  it('uses elevation when given and the seed otherwise', () => {
    const seed = placeProfile(58, 11).seed
    expect(placeProfile(58, 11, 1200).material).toBe('stone')
    expect(placeProfile(58, 11, 10).material).toBe(seed % 2 === 0 ? 'water' : 'wood')
    const mid = placeProfile(58, 11, 500).material
    expect(['metal', 'stone']).toContain(mid)
    expect(placeProfile(58, 11, null).material).toBe(
      ['wood', 'glass', 'metal', 'stone', 'water'][seed % 5],
    )
  })
})

describe('modes', () => {
  it('defines every mode relative to the root', () => {
    expect(MODES.dorian).toEqual([0, 2, 3, 5, 7, 9, 10])
    expect(MODES.phrygian).toEqual([0, 1, 3, 5, 7, 8, 10])
  })

  it('snaps a frequency to a degree of the mode', () => {
    const hz = snapHzToMode('aeolian', 1013 / 9)
    const midi = Math.round(69 + 12 * Math.log2(hz / 440))
    const pc = (((midi - 38) % 12) + 12) % 12
    expect(MODES.aeolian).toContain(pc)
  })
})
