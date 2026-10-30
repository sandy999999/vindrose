import type { AudioEvent } from '../domain/events'
import type { ChannelTargets } from '../domain/mapping'
import type { PlaceProfile } from '../domain/place'
import { AudioEngine, type ChannelId } from '../audio/engine'
import { defaultTimbre, type TimbreName } from '../audio/timbres'
import { Recorder } from '../audio/recorder'
import { fetchWeather } from '../weather/openMeteo'
import { loadLastPlace, loadMix, saveLastPlace, saveMix } from './persistence'
import { Session, type EngineLike } from './session'

class DeferredEngine implements EngineLike {
  private readonly mix = new Map<ChannelId, { gain: number; muted: boolean }>()
  private readonly timbres = new Map<ChannelId, TimbreName>()
  private readonly built: () => AudioEngine
  private target: { targets: ChannelTargets; tau: number } | null = null
  private profile: { profile: PlaceProfile; seconds: number } | null = null
  private tempo: number | null = null
  private barHandler: ((time: number, bar: number) => void) | null = null
  private frozen = false
  private master = 0.8
  private mutedAll = false
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
      if (this.profile) {
        this.engine.setProfile(this.profile.profile, this.profile.seconds)
      }
      if (this.tempo !== null) {
        this.engine.setTempo(this.tempo)
      }
      for (const [id, name] of this.timbres) {
        this.engine.setTimbre(id, name)
      }
      if (this.target) {
        this.engine.applyTargets(this.target.targets, this.target.tau)
      }
      if (this.barHandler) {
        this.engine.setBarHandler(this.barHandler)
      }
      this.engine.setFrozen(this.frozen)
      this.engine.setMaster(this.master)
      this.engine.setMutedAll(this.mutedAll)
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

  setProfile(profile: PlaceProfile, seconds = 0): void {
    this.profile = { profile, seconds }
    this.engine?.setProfile(profile, seconds)
  }

  setTempo(bpm: number): void {
    this.tempo = bpm
    this.engine?.setTempo(bpm)
  }

  setBarHandler(handler: (time: number, bar: number) => void): void {
    this.barHandler = handler
    this.engine?.setBarHandler(handler)
  }

  setTimbre(channel: ChannelId, name: TimbreName): void {
    if (name === defaultTimbre(channel)) {
      this.timbres.delete(channel)
    } else {
      this.timbres.set(channel, name)
    }
    this.engine?.setTimbre(channel, name)
  }

  setFrozen(frozen: boolean): void {
    this.frozen = frozen
    this.engine?.setFrozen(frozen)
  }

  setMaster(value: number): void {
    this.master = value
    this.engine?.setMaster(value)
  }

  setMutedAll(muted: boolean): void {
    this.mutedAll = muted
    this.engine?.setMutedAll(muted)
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
