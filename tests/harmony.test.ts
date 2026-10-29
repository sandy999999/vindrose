import { describe, it, expect } from 'vitest'
import { quantizeToScale, rootForPressure, isInScale } from '../src/lib/domain/harmony'

describe('harmony', () => {
  it('moves the root through the pressure zones', () => {
    expect(rootForPressure(990)).toBe(45)
    expect(rootForPressure(1000)).toBe(43)
    expect(rootForPressure(1010)).toBe(38)
    expect(rootForPressure(1025)).toBe(36)
  })

  it('keeps every root inside D Dorian', () => {
    for (const pressure of [985, 1000, 1010, 1030]) {
      expect(isInScale(rootForPressure(pressure))).toBe(true)
    }
  })

  it('quantises an out of scale note to the nearest scale note, ties up', () => {
    expect(quantizeToScale(61)).toBe(62)
    expect(quantizeToScale(62)).toBe(62)
    expect(quantizeToScale(60)).toBe(60)
  })
})
