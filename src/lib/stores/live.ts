import type { AudioEvent } from '../domain/events'
import type { ChannelTargets } from '../domain/mapping'
import { AudioEngine, type ChannelId } from '../audio/engine'
import { Recorder } from '../audio/recorder'
import { fetchWeather } from '../weather/openMeteo'
import { loadLastPlace, loadMix, saveLastPlace, saveMix } from './persistence'
import { Session, type EngineLike } from './session'

class DeferredEngine implements EngineLike {
  private readonly mix = new Map<ChannelId, { gain: number; muted: boolean }>()
  private readonly built: () => AudioEngine
  private target: { targets: ChannelTargets; tau: number } | null = null
  private frozen = false
  private engine: AudioEngine | null = null

  constructor(build: () => AudioEngine) {
    this.built = build
  }

  private ensure(): AudioEngine {
    if (!this.engine) {
      this.engine = this.built()
      for (const [id, state] of this.mix) {
        this.engine.setMix(id, state.gain, state.muted)
      }
      if (this.target) {
        this.engine.applyTargets(this.target.targets, this.target.tau)
      }
      this.engine.setFrozen(this.frozen)
    }
    return this.engine
  }

  get context(): AudioContext | null {
    return this.engine?.ctx ?? null
  }

  get tap(): AudioNode | null {
    return this.engine?.tap ?? null
  }

  async resume(): Promise<void> {
    await this.ensure().resume()
  }

  async start(): Promise<void> {
    await this.ensure().start()
  }

  stop(): void {
    this.engine?.stop()
  }

  applyTargets(targets: ChannelTargets, tau?: number): void {
    this.target = { targets, tau: tau ?? 20 }
    this.engine?.applyTargets(targets, tau)
  }

  setMix(channel: ChannelId, gain: number, muted: boolean): void {
    this.mix.set(channel, { gain, muted })
    this.engine?.setMix(channel, gain, muted)
  }

  setFrozen(frozen: boolean): void {
    this.frozen = frozen
    this.engine?.setFrozen(frozen)
  }

  fire(events: AudioEvent[]): void {
    this.engine?.fire(events)
  }
}

let instance: Session | null = null

export function getSession(): Session {
  if (instance) return instance

  const engine = new DeferredEngine(() => new AudioEngine(new AudioContext()))
  instance = new Session({
    engine,
    weather: (lat, lon) => fetchWeather(lat, lon),
    createRecorder: async () => {
      const ctx = engine.context
      const tap = engine.tap
      if (!ctx || !tap) throw new Error('Start the sound before recording')
      return Recorder.create(ctx, tap)
    },
    savePlace: saveLastPlace,
    loadPlace: loadLastPlace,
    saveMix,
    loadMix,
  })
  return instance
}
