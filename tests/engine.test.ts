import { afterEach, describe, expect, it, vi } from 'vitest'
import { AudioEngine, CHANNELS, eventTarget } from '../src/lib/audio/engine'
import { FakeAudioContext, asCtx } from './fakeAudio'
import { placeProfile } from '../src/lib/domain/place'
import type { ChannelTargets } from '../src/lib/domain/mapping'

function makeEngine() {
  const ctx = new FakeAudioContext()
  const engine = new AudioEngine(ctx as unknown as AudioContext)
  return { ctx, engine }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('AudioEngine pause', () => {
  it('suspends the context after stopping so the bed goes quiet', async () => {
    vi.useFakeTimers()
    const { ctx, engine } = makeEngine()

    await engine.start()
    expect(ctx.state).toBe('running')

    engine.stop()
    vi.advanceTimersByTime(500)
    await Promise.resolve()

    expect(ctx.state).toBe('suspended')

    await engine.start()
    expect(ctx.state).toBe('running')
  })

  it('cancels a pending pause when playback restarts at once', async () => {
    vi.useFakeTimers()
    const { ctx, engine } = makeEngine()

    await engine.start()
    engine.stop()
    await engine.start()
    vi.advanceTimersByTime(500)
    await Promise.resolve()

    expect(ctx.state).toBe('running')
    expect(ctx.suspensions).toBe(0)
  })

  it('does not keep the context suspended after a pause and a play', async () => {
    vi.useFakeTimers()
    const { ctx, engine } = makeEngine()

    await engine.start()
    engine.stop()
    vi.advanceTimersByTime(500)
    await Promise.resolve()
    await engine.start()

    expect(ctx.state).toBe('running')
    expect(ctx.resumptions).toBe(2)
  })
})

describe('AudioEngine channels', () => {
  it('runs seven channels in strip order', () => {
    expect(CHANNELS).toEqual(['wind', 'rain', 'gust', 'pressure', 'thunder', 'pad', 'motif'])
  })

  it('passes the tempo to the scheduler', () => {
    const fake = new FakeAudioContext()
    const engine = new AudioEngine(fake as unknown as AudioContext)
    engine.setTempo(63)
    expect(engine.tempo).toBe(63)
  })

  it('routes every event to its channel', () => {
    expect(eventTarget({ type: 'rain-change', state: 'rain' })).toBe('rain')
    expect(eventTarget({ type: 'pressure-glide', direction: 'up' })).toBe('pressure')
    expect(eventTarget({ type: 'direction-sweep', pan: 0 })).toBe('wind')
    expect(eventTarget({ type: 'temperature-note', note: 60 })).toBe('motif')
    expect(eventTarget({ type: 'thunder-crack', strength: 1 })).toBe('thunder')
    expect(eventTarget({ type: 'bell' })).toBe('pad')
  })
})

const sampleTargets: ChannelTargets = {
  wind: { level: 0, freq: 100, q: 8, pan: 0, breath: 1 },
  rain: { level: 0, density: 0, rate: 0, basePitch: 220 },
  gust: { level: 0 },
  pressure: { level: 0.35, targetHz: 55 },
  thunder: { level: 0 },
  pad: { level: 0, cutoff: 300, degree: 0 },
  motif: { level: 0, register: 50 },
  air: { shelfDb: 0 },
  reverb: { wet: 0.15, preDelay: 0.01 },
}

describe('AudioEngine air', () => {
  it('damps every weather voice with one shared high shelf', () => {
    const fake = new FakeAudioContext()
    const engine = new AudioEngine(asCtx(fake))
    engine.applyTargets({ ...sampleTargets, air: { shelfDb: -4 } }, 0)
    const shelf = fake.created.biquads.find((filter) => filter.type === 'highshelf')
    expect(shelf).toBeDefined()
    expect(shelf!.gain.value).toBeCloseTo(-4)
    expect(fake.created.biquads[0]).toBe(shelf)
  })
})

describe('AudioEngine place transition', () => {
  it('crossfades to a new voice set over four seconds', () => {
    vi.useFakeTimers()
    const fake = new FakeAudioContext()
    const engine = new AudioEngine(asCtx(fake))
    const before = engine.channelCount
    engine.setProfile(placeProfile(59.9, 10.7), 4)
    expect(engine.channelCount).toBe(before * 2)
    const ramps = fake.created.gains.flatMap((g) => g.gain.calls)
    expect(ramps.some((c) => c.method === 'linearRamp' && c.value === 1 && c.time === 4)).toBe(true)
    vi.advanceTimersByTime(4200)
    expect(engine.channelCount).toBe(before)
    vi.useRealTimers()
  })

  it('sends targets to the new set after the switch', () => {
    vi.useFakeTimers()
    const fake = new FakeAudioContext()
    const engine = new AudioEngine(asCtx(fake))
    engine.setProfile(placeProfile(59.9, 10.7), 4)
    vi.advanceTimersByTime(4200)
    engine.applyTargets(sampleTargets, 0)
    expect(engine.activeBusLevel).toBe(1)
    vi.useRealTimers()
  })
})
