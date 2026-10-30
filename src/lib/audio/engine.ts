import type { ChannelTargets } from '../domain/mapping'
import type { AudioEvent } from '../domain/events'
import type { PlaceProfile } from '../domain/place'
import { Scheduler } from './scheduler'
import { WindChannel } from './channels/wind'
import { GustChannel } from './channels/gust'
import { RainChannel } from './channels/rain'
import { PressureChannel } from './channels/pressure'
import { HumidityChannel } from './channels/humidity'
import { TemperatureChannel } from './channels/temperature'
import { TimbreChannel } from './channels/timbre'
import { SilentChannel } from './channels/silent'
import { defaultTimbre, type TimbreName } from './timbres'
import { createReverb } from './reverb'

export type ChannelId = 'wind' | 'rain' | 'gust' | 'pressure' | 'thunder' | 'pad' | 'motif'

export interface InstrumentChannel {
  readonly output: GainNode
  update(target: unknown, tau: number): void
  setProfile?(profile: PlaceProfile): void
  fire?(event: AudioEvent): void
  onBar?(time: number, bar: number): void
  dispose(): void
}

export const CHANNELS: ChannelId[] = [
  'wind',
  'rain',
  'gust',
  'pressure',
  'thunder',
  'pad',
  'motif',
]

export const BPM = 56
export const TRANSITION_SECONDS = 4

const PAUSE_SETTLE_MS = 150
const PAUSE_FADE = 0.015
const DIP_SECONDS = 0.15
const TRANSITION_SETTLE_MS = 200

interface MixState {
  gain: number
  muted: boolean
}

interface VoiceSet {
  bus: GainNode
  channels: Map<ChannelId, InstrumentChannel>
  mixGains: Map<ChannelId, GainNode>
  timbreChannels: Map<ChannelId, TimbreChannel>
}

export function eventTarget(event: AudioEvent): ChannelId {
  switch (event.type) {
    case 'gust-burst':
      return 'gust'
    case 'pressure-glide':
      return 'pressure'
    case 'rain-change':
      return 'rain'
    case 'direction-sweep':
      return 'wind'
    case 'temperature-note':
      return 'motif'
    case 'thunder-crack':
      return 'thunder'
    case 'bell':
      return 'pad'
  }
}

export class AudioEngine {
  readonly ctx: AudioContext

  private readonly compressor: DynamicsCompressorNode
  private readonly master: GainNode
  private readonly tapNode: GainNode
  private readonly silence: GainNode
  private readonly scheduler: Scheduler
  private readonly mix = new Map<ChannelId, MixState>()
  private readonly reverbInput: AudioNode | null
  private active: VoiceSet
  private fading: VoiceSet | null = null
  private fadeTimer: ReturnType<typeof setTimeout> | null = null
  private started = false
  private frozen = false
  private masterValue = 0.8
  private tempoValue = BPM
  private mutedAll = false
  private pauseTimer: ReturnType<typeof setTimeout> | null = null
  private onBarHandler: ((time: number, bar: number) => void) | null = null
  private reverb: { setWet(wet: number, preDelay: number): void } | null = null

  constructor(ctx: AudioContext) {
    this.ctx = ctx
    this.compressor = ctx.createDynamicsCompressor()
    this.compressor.threshold.value = -18
    this.compressor.ratio.value = 3
    this.master = ctx.createGain()
    this.master.gain.value = 0.8
    this.tapNode = ctx.createGain()
    this.silence = ctx.createGain()
    this.silence.gain.value = 0

    const reverb = createReverb(ctx)
    reverb.output.connect(this.compressor)
    this.reverb = reverb
    this.reverbInput = reverb.input

    this.compressor.connect(this.master)
    this.master.connect(ctx.destination)
    this.compressor.connect(this.tapNode)
    this.tapNode.connect(this.silence)
    this.silence.connect(ctx.destination)

    for (const id of CHANNELS) {
      this.mix.set(id, { gain: 1, muted: false })
    }

    this.active = this.createSet()

    this.scheduler = new Scheduler(
      BPM,
      (time, bar) => {
        this.onBarHandler?.(time, bar)
        for (const channel of this.active.channels.values()) {
          channel.onBar?.(time, bar)
        }
      },
      () => ctx.currentTime,
    )
  }

  get tap(): AudioNode {
    return this.tapNode
  }

  get isStarted(): boolean {
    return this.started
  }

  get tempo(): number {
    return this.tempoValue
  }

  get channelCount(): number {
    return this.active.channels.size + (this.fading?.channels.size ?? 0)
  }

  get activeBusLevel(): number {
    return this.active.bus.gain.value
  }

  setBarHandler(handler: (time: number, bar: number) => void): void {
    this.onBarHandler = handler
  }

  async resume(): Promise<void> {
    if (this.ctx.state !== 'running') {
      await this.ctx.resume()
    }
  }

  async start(): Promise<void> {
    this.cancelPause()
    await this.resume()
    const bus = this.active.bus
    bus.gain.cancelScheduledValues(this.ctx.currentTime)
    bus.gain.setTargetAtTime(1, this.ctx.currentTime, 0.01)
    if (!this.started) {
      this.started = true
      this.scheduler.start(this.ctx.currentTime)
    }
  }

  stop(): void {
    if (!this.started) return
    this.scheduler.stop()
    this.started = false
    const now = this.ctx.currentTime
    const bus = this.active.bus
    bus.gain.cancelScheduledValues(now)
    bus.gain.setTargetAtTime(0, now, PAUSE_FADE)
    this.cancelPause()
    this.pauseTimer = setTimeout(() => {
      this.pauseTimer = null
      if (!this.started) void this.ctx.suspend().catch(() => undefined)
    }, PAUSE_SETTLE_MS)
  }

  private cancelPause(): void {
    if (this.pauseTimer !== null) {
      clearTimeout(this.pauseTimer)
      this.pauseTimer = null
    }
  }

  setTimbre(channel: ChannelId, name: TimbreName): void {
    this.active.timbreChannels.get(channel)?.setTimbre(name)
  }

  setTempo(bpm: number): void {
    this.tempoValue = bpm
    this.scheduler.setBpm(bpm)
  }

  setProfile(profile: PlaceProfile, seconds = 0): void {
    this.setTempo(profile.tempo)
    const duration = seconds > 0 ? seconds : DIP_SECONDS
    const now = this.ctx.currentTime

    if (this.fadeTimer !== null) {
      clearTimeout(this.fadeTimer)
      this.fadeTimer = null
    }
    this.disposeSet(this.fading)
    this.fading = null

    const next = this.createSet()
    for (const channel of next.channels.values()) {
      channel.setProfile?.(profile)
    }
    next.bus.gain.setValueAtTime(0, now)
    next.bus.gain.linearRampToValueAtTime(1, now + duration)

    const previous = this.active
    previous.bus.gain.cancelScheduledValues(now)
    previous.bus.gain.setValueAtTime(previous.bus.gain.value, now)
    previous.bus.gain.linearRampToValueAtTime(0, now + duration)

    this.active = next
    this.fading = previous
    this.fadeTimer = setTimeout(() => {
      this.fadeTimer = null
      if (this.fading === previous) {
        this.disposeSet(previous)
        this.fading = null
      }
    }, duration * 1000 + TRANSITION_SETTLE_MS)
  }

  applyTargets(targets: ChannelTargets, tau = 20): void {
    const channels = this.active.channels
    channels.get('wind')?.update(targets.wind, tau)
    channels.get('rain')?.update(targets.rain, tau)
    channels.get('gust')?.update(targets.gust, tau)
    channels.get('pressure')?.update(targets.pressure, tau)
    channels.get('thunder')?.update(targets.thunder, tau)
    // The v1 pad and motif voices still read a root and a partial count.
    channels.get('pad')?.update({ ...targets.pad, root: 38 }, tau)
    channels.get('motif')?.update({ ...targets.motif, root: 38, partials: 4 }, tau)
    this.reverb?.setWet(targets.reverb.wet, targets.reverb.preDelay)
  }

  setMix(channel: ChannelId, gain: number, muted: boolean): void {
    this.mix.set(channel, { gain, muted })
    const mixGain = this.active.mixGains.get(channel)
    if (mixGain) {
      mixGain.gain.setTargetAtTime(muted ? 0 : gain, this.ctx.currentTime, 0.05)
    }
  }

  getMix(channel: ChannelId): MixState {
    return this.mix.get(channel) ?? { gain: 1, muted: false }
  }

  setMaster(value: number): void {
    this.masterValue = value
    if (!this.mutedAll) {
      this.master.gain.setTargetAtTime(value, this.ctx.currentTime, 0.05)
    }
  }

  setMutedAll(muted: boolean): void {
    this.mutedAll = muted
    const value = muted ? 0 : this.masterValue
    this.master.gain.setTargetAtTime(value, this.ctx.currentTime, 0.05)
  }

  setFrozen(frozen: boolean): void {
    this.frozen = frozen
  }

  fire(events: AudioEvent[]): void {
    if (this.frozen) return
    for (const event of events) {
      this.active.channels.get(eventTarget(event))?.fire?.(event)
    }
  }

  dispose(): void {
    this.cancelPause()
    if (this.fadeTimer !== null) {
      clearTimeout(this.fadeTimer)
      this.fadeTimer = null
    }
    this.scheduler.stop()
    this.disposeSet(this.active)
    this.disposeSet(this.fading)
    this.fading = null
  }

  private createSet(): VoiceSet {
    const bus = this.ctx.createGain()
    if (this.reverbInput) bus.connect(this.reverbInput)
    const channels = new Map<ChannelId, InstrumentChannel>()
    const mixGains = new Map<ChannelId, GainNode>()
    const timbreChannels = new Map<ChannelId, TimbreChannel>()

    for (const id of CHANNELS) {
      const channel = this.createChannel(id, timbreChannels)
      const state = this.mix.get(id) ?? { gain: 1, muted: false }
      const mixGain = this.ctx.createGain()
      mixGain.gain.value = state.muted ? 0 : state.gain
      channel.output.connect(mixGain)
      mixGain.connect(bus)
      channels.set(id, channel)
      mixGains.set(id, mixGain)
    }

    return { bus, channels, mixGains, timbreChannels }
  }

  private disposeSet(set: VoiceSet | null): void {
    if (set === null) return
    for (const channel of set.channels.values()) {
      channel.dispose()
    }
    for (const gain of set.mixGains.values()) {
      gain.disconnect()
    }
    set.bus.disconnect()
    set.channels.clear()
    set.mixGains.clear()
    set.timbreChannels.clear()
  }

  private createChannel(
    id: ChannelId,
    timbreChannels: Map<ChannelId, TimbreChannel>,
  ): InstrumentChannel {
    if (id !== 'pad' && id !== 'motif') {
      return this.createVoice(id, defaultTimbre(id))
    }
    const channel = new TimbreChannel(
      this.ctx,
      (name) => this.createVoice(id, name),
      defaultTimbre(id),
    )
    timbreChannels.set(id, channel)
    return channel
  }

  private createVoice(id: ChannelId, name: TimbreName): InstrumentChannel {
    switch (id) {
      case 'wind':
        return new WindChannel(this.ctx)
      case 'rain':
        return new RainChannel(this.ctx)
      case 'gust':
        return new GustChannel(this.ctx)
      case 'pressure':
        return new PressureChannel(this.ctx)
      case 'thunder':
        return new SilentChannel(this.ctx)
      case 'pad':
        return new HumidityChannel(this.ctx, name)
      case 'motif':
        return new TemperatureChannel(this.ctx, name)
    }
  }
}
