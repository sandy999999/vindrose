import { describe, it, expect } from 'vitest'
import { WindChannel } from '../src/lib/audio/channels/wind'
import { FakeAudioContext, asCtx } from './fakeAudio'

describe('WindChannel', () => {
  it('tunes two resonances and a noise bed from the wind target', () => {
    const fake = new FakeAudioContext()
    const channel = new WindChannel(asCtx(fake))
    channel.update({ level: 0.8, freq: 500, q: 26, pan: 0.3, breath: 0.5 }, 0)
    const [band, harmonic, bed] = fake.created.biquads
    expect(band!.frequency.value).toBe(500)
    expect(band!.Q.value).toBe(26)
    expect(harmonic!.frequency.value).toBeCloseTo(1350)
    expect(bed!.frequency.value).toBeCloseTo(600)
    expect(bed!.type).toBe('lowpass')
    expect(fake.created.panners[0]!.pan.value).toBeCloseTo(0.3)
  })
})
