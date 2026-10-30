import type { AudioEvent } from '../domain/events'
import { detectEvents, freshEventState, type EventState } from '../domain/events'
import type { ChannelTargets } from '../domain/mapping'
import { mapWeather } from '../domain/mapping'
import { placeProfile, type PlaceProfile } from '../domain/place'
import {
  bellAt,
  maskAt,
  nextSeed,
  planFor,
  sectionAt,
  thunderSlots,
  type LayerMask,
  type Plan,
  type Section,
} from '../domain/director'
import type { WeatherReading } from '../domain/types'
import { clamp } from '../domain/units'
import { CHANNELS, TRANSITION_SECONDS, type ChannelId } from '../audio/engine'
import { defaultTimbre, defaultTimbres, isTimbre, type TimbreName } from '../audio/timbres'
import { latestOnly } from '../weather/latest'
import type { WeatherSnapshot } from '../weather/openMeteo'
import type { Place } from '../weather/photon'

export const POLL_MS = 300_000
export const RETUNE_TAU = 2.5
export const AMBIENT_TAU = 20
export const MAX_CHANNEL_GAIN = 1.5
export const CHAINED_FADE_SECONDS = 20

const FULL_MASK: LayerMask = {
  wind: 1, rain: 1, gust: 1, pressure: 1, thunder: 1, pad: 1, motif: 1,
}

export interface Mix {
  gain: Record<ChannelId, number>
  muted: Record<ChannelId, boolean>
  timbre: Partial<Record<ChannelId, TimbreName>>
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
  setProfile(profile: PlaceProfile, seconds?: number): void
  setTempo(bpm: number): void
  setBarHandler?(handler: (time: number, bar: number) => void): void
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
  elevation?(lat: number, lon: number): Promise<number | null>
  createRecorder?(): Promise<RecorderLike>
  savePlace?(place: Place): void
  loadPlace?(): Place | null
  saveMix?(mix: Mix): void
  loadMix?(): Mix | null
  now?(): number
}

export interface SessionState {
  place: Place | null
  profile: PlaceProfile | null
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
  timbre: Partial<Record<ChannelId, TimbreName>>
  section: Section | null
  pieceSeed: number
  plan: Plan | null
  levels: Record<ChannelId, number>
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
    }
    for (const id of Object.keys(timbre) as ChannelId[]) {
      const name = mix.timbre?.[id]
      if (typeof name === 'string' && isTimbre(id, name)) {
        timbre[id] = name
      }
    }
  }
  return { gain, muted, timbre }
}

function applyMask(targets: ChannelTargets, mask: LayerMask): ChannelTargets {
  return {
    ...targets,
    wind: { ...targets.wind, level: targets.wind.level * mask.wind },
    rain: { ...targets.rain, level: targets.rain.level * mask.rain },
    gust: { ...targets.gust, level: targets.gust.level * mask.gust },
    pressure: { ...targets.pressure, level: targets.pressure.level * mask.pressure },
    thunder: { ...targets.thunder, level: targets.thunder.level * mask.thunder },
    pad: { ...targets.pad, level: targets.pad.level * mask.pad },
    motif: { ...targets.motif, level: targets.motif.level * mask.motif },
  }
}

function levelsOf(targets: ChannelTargets): Record<ChannelId, number> {
  return {
    wind: targets.wind.level,
    rain: targets.rain.level,
    gust: targets.gust.level,
    pressure: targets.pressure.level,
    thunder: targets.thunder.level,
    pad: targets.pad.level,
    motif: targets.motif.level,
  }
}

function elevationKey(place: Place): string {
  return `${place.lat.toFixed(3)},${place.lon.toFixed(3)}`
}

export class Session {
  private readonly latest = latestOnly<WeatherSnapshot>()
  private readonly listeners = new Set<(state: SessionState) => void>()
  private readonly elevationCache = new Map<string, number | null>()
  private state: SessionState
  private recorder: RecorderLike | null = null
  private recordingPlace: Place | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private requestId = 0
  private prevReading: WeatherReading | null = null
  private eventState: EventState = freshEventState()
  private piece: Plan | null = null
  private pieceIndex = 0
  private baseSeed: number | null = null
  private pieceStartMs = 0
  private pausedElapsedMs = 0
  private pendingProfile: PlaceProfile | null = null
  private bellFired = false
  private readonly thunderFired = new Set<number>()

  constructor(private readonly deps: SessionDeps) {
    const mix = normalizeMix(deps.loadMix?.() ?? null)
    this.state = {
      place: deps.loadPlace?.() ?? null,
      profile: null,
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
      section: null,
      pieceSeed: 0,
      plan: null,
      levels: channelMap(0),
    }
    for (const id of CHANNELS) {
      deps.engine.setMix(id, mix.gain[id], mix.muted[id])
      const name = mix.timbre[id]
      if (name !== undefined && name !== defaultTimbre(id)) {
        deps.engine.setTimbre(id, name)
      }
    }
    deps.engine.setBarHandler?.(() => this.tick())
  }

  get snapshot(): SessionState {
    return this.state
  }

  get elapsedSec(): number {
    if (this.piece === null) return 0
    if (!this.state.playing) return this.pausedElapsedMs / 1000
    return (this.now() - this.pieceStartMs) / 1000
  }

  subscribe(listener: (state: SessionState) => void): () => void {
    this.listeners.add(listener)
    listener(this.state)
    return () => {
      this.listeners.delete(listener)
    }
  }

  async selectPlace(place: Place): Promise<void> {
    const id = (this.requestId += 1)
    this.prevReading = null
    this.eventState = freshEventState()
    this.pendingProfile = null

    const profile = this.profileFor(place)
    this.baseSeed = profile.seed
    this.pieceIndex = 0
    this.set({ place, profile })
    this.deps.savePlace?.(place)
    this.startPolling()

    if (this.piece !== null) {
      this.beginPiece(this.state.playing ? TRANSITION_SECONDS : 0)
    } else {
      this.deps.engine.setProfile(profile, 0)
    }
    this.requestElevation(place)

    await this.refresh(RETUNE_TAU, id)
  }

  async play(): Promise<void> {
    if (this.state.playing) return
    this.set({ playing: true })
    if (this.piece === null) {
      this.beginPiece(0)
    } else {
      this.pieceStartMs = this.now() - this.pausedElapsedMs
    }
    await this.deps.engine.resume()
    await this.deps.engine.start()
  }

  pause(): void {
    if (!this.state.playing) return
    this.pausedElapsedMs = this.elapsedSec * 1000
    this.deps.engine.stop()
    this.set({ playing: false })
  }

  tick(tau: number = RETUNE_TAU): void {
    const profile = this.state.profile
    const reading = this.state.reading
    if (profile === null || reading === null) return

    const elapsed = this.elapsedSec
    if (this.piece !== null && elapsed >= this.piece.lengthSec) {
      this.beginPiece(CHAINED_FADE_SECONDS)
      return
    }

    const mask = this.piece === null ? FULL_MASK : maskAt(this.piece, elapsed)
    const targets = applyMask(mapWeather(reading, profile, elapsed), mask)
    this.deps.engine.applyTargets(targets, tau)
    this.set({ levels: levelsOf(targets) })

    if (this.piece === null) return
    const section = sectionAt(this.piece, elapsed)
    if (section !== this.state.section) {
      this.set({ section })
    }
    if (!this.bellFired && elapsed >= bellAt(this.piece)) {
      this.bellFired = true
      this.deps.engine.fire([{ type: 'bell' }])
    }
    for (const slot of thunderSlots(this.piece, reading)) {
      if (elapsed < slot || this.thunderFired.has(slot)) continue
      this.thunderFired.add(slot)
      this.deps.engine.fire([{ type: 'thunder-crack', strength: 1 }])
    }
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

  private beginPiece(fadeSeconds: number): void {
    const profile = this.pendingProfile ?? this.state.profile
    if (profile === null) return
    this.pendingProfile = null

    this.pieceIndex += 1
    this.baseSeed = this.baseSeed ?? profile.seed
    const seed = nextSeed(this.baseSeed, this.pieceIndex)
    const plan = planFor(seed, this.state.reading)
    this.piece = plan
    this.pieceStartMs = this.now()
    this.pausedElapsedMs = 0
    this.bellFired = false
    this.thunderFired.clear()

    this.deps.engine.setTempo(profile.tempo)
    this.deps.engine.setProfile(profile, fadeSeconds)
    this.set({
      profile,
      pieceSeed: seed,
      plan,
      section: sectionAt(plan, 0),
    })
    this.tick()
  }

  private profileFor(place: Place): PlaceProfile {
    const cached = this.elevationCache.get(elevationKey(place))
    return placeProfile(place.lat, place.lon, cached ?? null)
  }

  private requestElevation(place: Place): void {
    const key = elevationKey(place)
    if (this.elevationCache.has(key) || !this.deps.elevation) return
    void this.deps
      .elevation(place.lat, place.lon)
      .then((value) => {
        this.elevationCache.set(key, value)
        if (this.state.place !== place) return
        this.applyElevation(place, value)
      })
      .catch(() => undefined)
  }

  private applyElevation(place: Place, elevation: number | null): void {
    const profile = placeProfile(place.lat, place.lon, elevation)
    if (this.piece !== null) {
      this.pendingProfile = profile
      return
    }
    this.set({ profile })
    this.deps.engine.setProfile(profile, 0)
    this.tick()
  }

  private now(): number {
    return this.deps.now?.() ?? Date.now()
  }

  private async refresh(tau: number, id?: number): Promise<void> {
    const place = this.state.place
    if (!place) return

    const requestId = id ?? (this.requestId += 1)
    try {
      const snapshot = await this.latest(() => this.deps.weather(place.lat, place.lon))
      if (snapshot === null || requestId !== this.requestId) return
      this.apply(snapshot, tau)
    } catch {
      if (requestId !== this.requestId) return
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

    this.tick(tau)

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
