import { afterEach, describe, expect, it, vi } from 'vitest'
import { AudioEngine, CHANNELS, eventTarget } from '../src/lib/audio/engine'
import { FakeAudioContext } from './fakeAudio'

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
