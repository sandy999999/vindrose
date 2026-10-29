import type { AudioEvent } from '../domain/events'
import { detectEvents, freshEventState, type EventState } from '../domain/events'
import type { ChannelTargets } from '../domain/mapping'
import { mapWeather } from '../domain/mapping'
import type { WeatherReading } from '../domain/types'
import { clamp } from '../domain/units'
import { CHANNELS, type ChannelId } from '../audio/engine'
import { defaultTimbre, defaultTimbres, isTimbre, type TimbreName } from '../audio/timbres'
import { latestOnly } from '../weather/latest'
import type { WeatherSnapshot } from '../weather/openMeteo'
import type { Place } from '../weather/photon'

export const POLL_MS = 300_000
export const RETUNE_TAU = 2.5
export const AMBIENT_TAU = 20
export const MAX_CHANNEL_GAIN = 1.5

export interface Mix {
  gain: Record<ChannelId, number>
  muted: Record<ChannelId, boolean>
  timbre: Record<ChannelId, TimbreName>
}

export interface EngineLike {
  start(): Promise<void>
  resume(): Promise<void>
  stop(): void
  applyTargets(targets: ChannelTargets, tau?: number): void
  setMix(channel: ChannelId, gain: number, muted: boolean): void
  setMaster(value: number): void
  setMutedAll(muted: boolean): void
  setFrozen(frozen: boolean): void
  setTimbre(channel: ChannelId, name: TimbreName): void
  fire(events: AudioEvent[]): void
}

export interface RecorderLike {
  readonly isRecording: boolean
  readonly elapsed: number
  start(): void
  stop(): { blob: Blob; durationSec: number }
}

export interface SessionDeps {
  engine: EngineLike
  weather(lat: number, lon: number): Promise<WeatherSnapshot>
  createRecorder?(): Promise<RecorderLike>
  savePlace?(place: Place): void
  loadPlace?(): Place | null
  saveMix?(mix: Mix): void
  loadMix?(): Mix | null
  now?(): number
}

export interface SessionState {
  place: Place | null
  reading: WeatherReading | null
  tendency: number
  playing: boolean
  recording: boolean
  stale: boolean
  frozen: boolean
  master: number
  mutedAll: boolean
  channelGain: Record<ChannelId, number>
  channelMuted: Record<ChannelId, boolean>
  timbre: Record<ChannelId, TimbreName>
}

function channelMap<T>(value: T): Record<ChannelId, T> {
  const map = {} as Record<ChannelId, T>
  for (const id of CHANNELS) {
    map[id] = value
  }
  return map
}

function normalizeMix(mix: Mix | null): Mix {
  const gain = channelMap(1)
  const muted = channelMap(false)
  const timbre = defaultTimbres()
  if (mix) {
    for (const id of CHANNELS) {
      const value = mix.gain?.[id]
      if (typeof value === 'number' && Number.isFinite(value)) {
        gain[id] = clamp(value, 0, MAX_CHANNEL_GAIN)
      }
      muted[id] = mix.muted?.[id] === true
      const name = mix.timbre?.[id]
      if (typeof name === 'string' && isTimbre(id, name)) {
        timbre[id] = name
      }
    }
  }
  return { gain, muted, timbre }
}

export class Session {
  private readonly latest = latestOnly<WeatherSnapshot>()
  private readonly listeners = new Set<(state: SessionState) => void>()
  private state: SessionState
  private recorder: RecorderLike | null = null
  private recordingPlace: Place | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private requestId = 0
  private prevReading: WeatherReading | null = null
  private eventState: EventState = freshEventState()

  constructor(private readonly deps: SessionDeps) {
    const mix = normalizeMix(deps.loadMix?.() ?? null)
    this.state = {
      place: deps.loadPlace?.() ?? null,
      reading: null,
      tendency: 0,
      playing: false,
      recording: false,
      stale: false,
      frozen: false,
      master: 0.8,
      mutedAll: false,
      channelGain: mix.gain,
      channelMuted: mix.muted,
      timbre: mix.timbre,
    }
    for (const id of CHANNELS) {
      deps.engine.setMix(id, mix.gain[id], mix.muted[id])
      if (mix.timbre[id] !== defaultTimbre(id)) {
        deps.engine.setTimbre(id, mix.timbre[id])
      }
    }
  }

  get snapshot(): SessionState {
    return this.state
  }

  subscribe(listener: (state: SessionState) => void): () => void {
    this.listeners.add(listener)
    listener(this.state)
    return () => {
      this.listeners.delete(listener)
    }
  }

  async selectPlace(place: Place): Promise<void> {
    this.prevReading = null
    this.eventState = freshEventState()
    this.set({ place })
    this.deps.savePlace?.(place)
    this.startPolling()
    await this.refresh(RETUNE_TAU)
  }

  async play(): Promise<void> {
    if (this.state.playing) return
    this.set({ playing: true })
    await this.deps.engine.resume()
    await this.deps.engine.start()
  }

  pause(): void {
    if (!this.state.playing) return
    this.deps.engine.stop()
    this.set({ playing: false })
  }

  async startRecording(): Promise<void> {
    if (this.state.recording || !this.deps.createRecorder) return
    const recorder = await this.deps.createRecorder()
    this.recorder = recorder
    this.recordingPlace = this.state.place
    recorder.start()
    this.set({ recording: true })
  }

  stopRecording(): {
    blob: Blob
    durationSec: number
    place: Place | null
  } | null {
    if (!this.recorder || !this.state.recording) return null
    const result = this.recorder.stop()
    const place = this.recordingPlace
    this.recorder = null
    this.recordingPlace = null
    this.set({ recording: false })
    return { ...result, place }
  }

  get recordingSeconds(): number {
    return this.recorder?.elapsed ?? 0
  }

  setChannelGain(id: ChannelId, value: number): void {
    const gain = clamp(value, 0, MAX_CHANNEL_GAIN)
    this.set({ channelGain: { ...this.state.channelGain, [id]: gain } })
    this.deps.engine.setMix(id, gain, this.state.channelMuted[id])
    this.persistMix()
  }

  toggleMute(id: ChannelId): void {
    const muted = !this.state.channelMuted[id]
    this.set({ channelMuted: { ...this.state.channelMuted, [id]: muted } })
    this.deps.engine.setMix(id, this.state.channelGain[id], muted)
    this.persistMix()
  }

  toggleMuteAll(): void {
    const mutedAll = !this.state.mutedAll
    this.set({ mutedAll })
    this.deps.engine.setMutedAll(mutedAll)
  }

  setMaster(value: number): void {
    const master = clamp(value, 0, 1)
    this.set({ master })
    this.deps.engine.setMaster(master)
  }

  setTimbre(id: ChannelId, name: TimbreName): void {
    if (!isTimbre(id, name)) return
    if (this.state.timbre[id] === name) return
    this.set({ timbre: { ...this.state.timbre, [id]: name } })
    this.deps.engine.setTimbre(id, name)
    this.persistMix()
  }

  toggleFreeze(): void {
    const frozen = !this.state.frozen
    this.set({ frozen })
    this.deps.engine.setFrozen(frozen)
  }

  dispose(): void {
    this.stopPolling()
    this.listeners.clear()
  }

  private async refresh(tau: number): Promise<void> {
    const place = this.state.place
    if (!place) return

    const id = (this.requestId += 1)
    try {
      const snapshot = await this.latest(() => this.deps.weather(place.lat, place.lon))
      if (snapshot === null || id !== this.requestId) return
      this.apply(snapshot, tau)
    } catch {
      if (id !== this.requestId) return
      this.set({ stale: true })
    }
  }

  private apply(snapshot: WeatherSnapshot, tau: number): void {
    const previous = this.prevReading
    this.set({
      reading: snapshot.reading,
      tendency: snapshot.pressureTendency,
      stale: false,
    })

    this.deps.engine.applyTargets(
      mapWeather(snapshot.reading, snapshot.pressureTendency),
      tau,
    )

    const events = detectEvents(
      previous,
      snapshot.reading,
      snapshot.pressureTendency,
      this.deps.now?.() ?? Date.now(),
      this.eventState,
    )
    this.prevReading = snapshot.reading
    if (events.length > 0) {
      this.deps.engine.fire(events)
    }
  }

  private startPolling(): void {
    this.stopPolling()
    this.timer = setInterval(() => {
      void this.refresh(AMBIENT_TAU)
    }, POLL_MS)
    ;(this.timer as { unref?: () => void }).unref?.()
  }

  private stopPolling(): void {
    if (this.timer !== null) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  private persistMix(): void {
    this.deps.saveMix?.({
      gain: this.state.channelGain,
      muted: this.state.channelMuted,
      timbre: this.state.timbre,
    })
  }

  private set(patch: Partial<SessionState>): void {
    this.state = { ...this.state, ...patch }
    for (const listener of this.listeners) {
      listener(this.state)
    }
  }
}
