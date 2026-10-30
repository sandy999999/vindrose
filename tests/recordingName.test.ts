import { describe, it, expect } from 'vitest'
import { recordingName } from '../src/lib/domain/recordingName'

describe('recordingName', () => {
  it('names the place, the local time and the seed', () => {
    const date = new Date(2026, 9, 30, 14, 5)
    expect(
      recordingName({ name: 'Käringön', lat: 58.11, lon: 11.32, country: null }, date, 0x1a2b3c4d),
    ).toBe('vindrose-karingon-20261030-1405-1a2b3c4d.wav')
  })

  it('falls back to vindrose for a missing place', () => {
    expect(recordingName(null, new Date(2026, 0, 2, 3, 4), 1)).toBe(
      'vindrose-vindrose-20260102-0304-00000001.wav',
    )
  })
})
