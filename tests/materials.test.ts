import { describe, it, expect } from 'vitest'
import { MATERIAL_SPEC, basePitch } from '../src/lib/domain/materials'
import { snapHzToMode } from '../src/lib/domain/harmony'

describe('material spec', () => {
  it('carries the spec ratios', () => {
    expect(MATERIAL_SPEC.wood.ratios).toEqual([1, 2.32, 4.25, 6.63])
    expect(MATERIAL_SPEC.glass.ratios).toEqual([1, 2.76, 5.4, 8.93])
    expect(MATERIAL_SPEC.water.ratios).toEqual([1, 1.59, 2.14, 2.65])
  })

  it('keeps every base range ordered and inside hearing', () => {
    for (const spec of Object.values(MATERIAL_SPEC)) {
      expect(spec.baseLow).toBeLessThan(spec.baseHigh)
      expect(spec.baseLow).toBeGreaterThan(50)
      expect(spec.ratios[3]).toBeLessThan(10)
    }
  })
})

describe('basePitch', () => {
  it('picks an in-key base pitch inside the material range', () => {
    for (let seed = 0; seed < 30; seed += 1) {
      const hz = basePitch('wood', seed, 'aeolian')
      expect(hz).toBeGreaterThanOrEqual(120)
      expect(hz).toBeLessThanOrEqual(300)
      expect(hz).toBe(snapHzToMode('aeolian', hz))
    }
  })
})
