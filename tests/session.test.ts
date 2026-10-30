import { describe, it, expect, vi } from 'vitest'
import { Session } from '../src/lib/stores/session'
import type { SessionDeps, EngineLike, Mix, RecorderLike } from '../src/lib/stores/session'
import { defaultTimbre } from '../src/lib/audio/timbres'
import { CHANNELS, type ChannelId } from '../src/lib/audio/engine'
import type { ChannelTargets } from '../src/lib/domain/mapping'
import type { WeatherReading } from '../src/lib/domain/types'
import type { Place } from '../src/lib/weather/photon'

const reading: WeatherReading = {
  time: '2026-10-29T12:00',
  windSpeed: 9.2,
  windGust: 14.8,
  windDirection: 240,
  temperature: 7.1,
  humidity: 87,
  pressure: 1008.6,
  precipitation: 2.4,
  cloudCover: 100,
  weatherCode: 61,
}

const place: Place = { name: 'Käringön', lat: 58.11, lon: 11.32, country: 'Sweden' }
const otherPlace: Place = { name: 'Oslo', lat: 59.91, lon: 10.75, country: 'Norway' }

class FakeEngine implements EngineLike {
  started = 0
  resumed = 0
  stopped = 0
  targets: ChannelTargets[] = []
  events: unknown[] = []
  mixes: Array<{ id: string; gain: number; muted: boolean }> = []
  master: number[] = []
  mutedAll: boolean[] = []
  frozen = false
  timbres: Array<{ id: string; name: string }> = []

  async start(): Promise<void> {
    this.started += 1
  }
  async resume(): Promise<void> {
    this.resumed += 1
  }
  stop(): void {
    this.stopped += 1
  }
  applyTargets(targets: ChannelTargets): void {
    this.targets.push(targets)
  }
  setMix(id: string, gain: number, muted: boolean): void {
    this.mixes.push({ id, gain, muted })
  }
  setMaster(value: number): void {
    this.master.push(value)
  }
  setMutedAll(muted: boolean): void {
    this.mutedAll.push(muted)
  }
  setFrozen(frozen: boolean): void {
    this.frozen = frozen
  }
  setTimbre(id: string, name: string): void {
    this.timbres.push({ id, name })
  }
  fire(events: unknown[]): void {
    this.events.push(...events)
  }
  get tap(): AudioNode {
    return null as unknown as AudioNode
  }
}

class FakeRecorder implements RecorderLike {
  started = false
  isRecording = false
  elapsed = 0
  start(): void {
    this.started = true
    this.isRecording = true
  }
  stop(): { blob: Blob; durationSec: number } {
    this.isRecording = false
    return { blob: new Blob(['x']), durationSec: 3 }
  }
}

function makeDeps(overrides: Partial<SessionDeps> = {}) {
  const engine = new FakeEngine()
  const recorder = new FakeRecorder()
  const savePlace = vi.fn()
  const saveMix = vi.fn()
  const deps: SessionDeps = {
    engine,
    weather: async () => ({ reading, pressureTendency: -0.9 }),
    createRecorder: async () => recorder,
    savePlace,
    loadPlace: () => null,
    saveMix,
    loadMix: () => null,
    now: () => 1000,
    ...overrides,
  }
  return { deps, engine, recorder, savePlace, saveMix }
}

function channelGains<T>(value: T): Record<ChannelId, T> {
  const map = {} as Record<ChannelId, T>
  for (const id of CHANNELS) map[id] = value
  return map
}

const channelMutes = channelGains<boolean>

describe('Session', () => {
  it('sets the place and saves it before the weather arrives', async () => {
    const { deps, savePlace } = makeDeps()
    const session = new Session(deps)

    const pending = session.selectPlace(place)
    expect(session.snapshot.place).toEqual(place)
    expect(savePlace).toHaveBeenCalledWith(place)

    await pending
    session.dispose()
  })

  it('applies targets and fires events after a reading', async () => {
    const { deps, engine } = makeDeps()
    const session = new Session(deps)

    await session.selectPlace(place)
    expect(engine.targets).toHaveLength(1)
    expect(session.snapshot.reading?.windSpeed).toBe(9.2)
    expect(session.snapshot.stale).toBe(false)

    session.dispose()
  })

  it('keeps the last reading and marks stale when the fetch fails', async () => {
    let fail = false
    const { deps } = makeDeps({
      weather: async () => {
        if (fail) throw new Error('offline')
        return { reading, pressureTendency: 0 }
      },
    })
    const session = new Session(deps)

    await session.selectPlace(place)
    fail = true
    await session.selectPlace(otherPlace)

    expect(session.snapshot.place).toEqual(otherPlace)
    expect(session.snapshot.reading).toEqual(reading)
    expect(session.snapshot.stale).toBe(true)

    session.dispose()
  })

  it('does not stop an active recording when the place changes', async () => {
    const { deps, recorder } = makeDeps()
    const session = new Session(deps)

    await session.play()
    await session.startRecording()
    await session.selectPlace(otherPlace)

    expect(recorder.isRecording).toBe(true)
    expect(session.snapshot.recording).toBe(true)

    session.dispose()
  })

  it('keeps each channel mix independent and persists it', async () => {
    const { deps, engine, saveMix } = makeDeps()
    const session = new Session(deps)

    session.setChannelGain('wind', 0.4)
    session.toggleMute('rain')

    expect(session.snapshot.channelGain.wind).toBe(0.4)
    expect(session.snapshot.channelMuted.rain).toBe(true)
    expect(session.snapshot.channelMuted.wind).toBe(false)
    expect(engine.mixes).toContainEqual({ id: 'wind', gain: 0.4, muted: false })
    expect(saveMix).toHaveBeenCalled()

    await session.selectPlace(otherPlace)
    expect(session.snapshot.channelGain.wind).toBe(0.4)

    session.dispose()
  })

  it('does not start audio when choosing a place while paused, but play starts it', async () => {
    const { deps, engine } = makeDeps()
    const session = new Session(deps)

    await session.selectPlace(place)
    expect(engine.started).toBe(0)

    await session.play()
    expect(engine.resumed).toBe(1)
    expect(engine.started).toBe(1)

    session.dispose()
  })

  it('returns a wav blob on stop', async () => {
    const { deps } = makeDeps()
    const session = new Session(deps)

    await session.play()
    await session.startRecording()
    const result = session.stopRecording()

    expect(result?.durationSec).toBe(3)
    expect(session.snapshot.recording).toBe(false)

    session.dispose()
  })

  it('returns the place that was active when the recording started', async () => {
    const { deps } = makeDeps()
    const session = new Session(deps)

    await session.play()
    await session.selectPlace(place)
    await session.startRecording()
    await session.selectPlace(otherPlace)
    const result = session.stopRecording()

    expect(result?.place).toEqual(place)

    session.dispose()
  })

  it('mutes the master output without touching the channel mix', () => {
    const { deps, engine, saveMix } = makeDeps()
    const session = new Session(deps)
    const mixesBefore = engine.mixes.length

    session.toggleMuteAll()
    expect(session.snapshot.mutedAll).toBe(true)
    expect(engine.mutedAll).toEqual([true])
    expect(session.snapshot.channelMuted.wind).toBe(false)
    expect(engine.mixes).toHaveLength(mixesBefore)

    session.toggleMuteAll()
    expect(session.snapshot.mutedAll).toBe(false)
    expect(engine.mutedAll).toEqual([true, false])
    expect(saveMix).not.toHaveBeenCalled()

    session.dispose()
  })

  it('clamps master volume and forwards it to the engine', () => {
    const { deps, engine } = makeDeps()
    const session = new Session(deps)

    session.setMaster(1.4)
    expect(session.snapshot.master).toBe(1)
    expect(engine.master).toEqual([1])

    session.setMaster(0.35)
    expect(session.snapshot.master).toBe(0.35)

    session.dispose()
  })

  it('uses the default timbre for the two musical voices', () => {
    const { deps } = makeDeps()
    const session = new Session(deps)

    expect(session.snapshot.timbre.pad).toBe(defaultTimbre('pad'))
    expect(session.snapshot.timbre.motif).toBe(defaultTimbre('motif'))
    expect(session.snapshot.timbre.wind).toBeUndefined()

    session.dispose()
  })

  it('rejects an unknown timbre and keeps the previous one', () => {
    const { deps, engine } = makeDeps()
    const session = new Session(deps)

    session.setTimbre('pad', 'thunder')
    expect(session.snapshot.timbre.pad).toBe(defaultTimbre('pad'))
    expect(engine.timbres).toEqual([])

    session.dispose()
  })

  it('stores, forwards and persists a valid timbre', () => {
    const { deps, engine, saveMix } = makeDeps()
    const session = new Session(deps)

    session.setTimbre('pad', 'choir')

    expect(session.snapshot.timbre.pad).toBe('choir')
    expect(engine.timbres).toContainEqual({ id: 'pad', name: 'choir' })
    expect(saveMix).toHaveBeenCalled()

    session.dispose()
  })

  it('restores persisted timbres and restores the default for a bad stored name', () => {
    const { deps, engine } = makeDeps({
      loadMix: () => ({
        gain: channelGains(1),
        muted: channelMutes(false),
        timbre: { pad: 'glass', motif: 'not-a-timbre' },
      }),
    })
    const session = new Session(deps)

    expect(session.snapshot.timbre.pad).toBe('glass')
    expect(session.snapshot.timbre.motif).toBe(defaultTimbre('motif'))
    expect(engine.timbres).toContainEqual({ id: 'pad', name: 'glass' })

    session.dispose()
  })

  it('opens a v1 mix without a crash and keeps the gains it still has', () => {
    const v1 = {
      gain: { wind: 0.4, humidity: 0.7 },
      muted: { humidity: true },
      timbre: { humidity: 'choir' },
    }
    const { deps } = makeDeps({ loadMix: () => v1 as unknown as Mix })
    const session = new Session(deps)

    expect(session.snapshot.channelGain.wind).toBe(0.4)
    expect(session.snapshot.channelGain.pad).toBe(1)
    expect(session.snapshot.channelGain.motif).toBe(1)
    expect(session.snapshot.channelMuted.pad).toBe(false)

    session.dispose()
  })
})
