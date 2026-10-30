import { describe, it, expect } from 'vitest'
import { WindChannel } from '../src/lib/audio/channels/wind'
import { RainChannel } from '../src/lib/audio/channels/rain'
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

describe('RainChannel', () => {
  it('tunes four resonances to the material ratios', () => {
    const fake = new FakeAudioContext()
    const channel = new RainChannel(asCtx(fake), 'glass')
    channel.update({ level: 0.5, density: 0.5, basePitch: 1000 }, 0)
    const freqs = fake.created.biquads.map((f) => f.frequency.value)
    expect(freqs.slice(0, 4)).toEqual([1000, 2760, 5400, 8930])
    expect(fake.created.biquads.slice(0, 4).every((f) => f.Q.value === 40)).toBe(true)
  })
})
