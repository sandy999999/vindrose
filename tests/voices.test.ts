import { describe, it, expect } from 'vitest'
import { WindChannel } from '../src/lib/audio/channels/wind'
import { RainChannel } from '../src/lib/audio/channels/rain'
import { PressureChannel } from '../src/lib/audio/channels/pressure'
import { ThunderChannel } from '../src/lib/audio/channels/thunder'
import { PadChannel } from '../src/lib/audio/channels/pad'
import { MotifChannel } from '../src/lib/audio/channels/motif'
import { placeProfile } from '../src/lib/domain/place'
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

describe('PressureChannel', () => {
  it('tunes the pressure loop to the target frequency', () => {
    const fake = new FakeAudioContext()
    const channel = new PressureChannel(asCtx(fake))
    channel.update({ level: 0.35, targetHz: 80 }, 0)
    expect(fake.created.delays[0]!.delayTime.value).toBeCloseTo(1 / 80)
    expect(fake.created.gains[0]!.gain.value).toBeCloseTo(0.93)
  })
})

describe('ThunderChannel', () => {
  it('fires a low rumble with a bright crack', () => {
    const fake = new FakeAudioContext()
    const channel = new ThunderChannel(asCtx(fake))
    channel.fire({ type: 'thunder-crack', strength: 0.8 })
    const freqs = fake.created.biquads.map((f) => f.frequency.value)
    expect(freqs.some((f) => f >= 60 && f <= 180)).toBe(true)
    expect(freqs.some((f) => f > 1000)).toBe(true)
    expect(fake.created.sources.length).toBeGreaterThanOrEqual(2)
  })
})

describe('PadChannel', () => {
  it('moves the pad through the chord cycle', () => {
    const fake = new FakeAudioContext()
    const pad = new PadChannel(asCtx(fake), 'pad')
    pad.setProfile(placeProfile(58, 11))
    pad.update({ level: 0.5, cutoff: 900, degree: 0 }, 0)
    const degree0 = fake.created.oscs.map((o) => o.frequency.value)
    pad.update({ level: 0.5, cutoff: 900, degree: 2 }, 0)
    const degree2 = fake.created.oscs.map((o) => o.frequency.value)
    expect(degree0).toHaveLength(3)
    expect(degree2).not.toEqual(degree0)
  })
})

describe('MotifChannel', () => {
  it('schedules a phrase of two to five notes on the bar grid', () => {
    const fake = new FakeAudioContext()
    const motif = new MotifChannel(asCtx(fake))
    motif.setProfile(placeProfile(58, 11))
    motif.onBar(10, 0)
    const notes = fake.created.oscs
    expect(notes.length).toBeGreaterThanOrEqual(2)
    expect(notes.length).toBeLessThanOrEqual(5)
    expect(notes[0]?.startedAt).toBe(10)
  })
})
