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

const PAUSE_SETTLE_MS = 150
const PAUSE_FADE = 0.015

interface MixState {
  gain: number
  muted: boolean
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

  private readonly bus: GainNode
  private readonly compressor: DynamicsCompressorNode
  private readonly master: GainNode
  private readonly tapNode: GainNode
  private readonly silence: GainNode
  private readonly scheduler: Scheduler
  private readonly channels = new Map<ChannelId, InstrumentChannel>()
  private readonly timbreChannels = new Map<ChannelId, TimbreChannel>()
  private readonly mixGains = new Map<ChannelId, GainNode>()
  private readonly mix = new Map<ChannelId, MixState>()
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
    this.bus = ctx.createGain()
    this.compressor = ctx.createDynamicsCompressor()
    this.compressor.threshold.value = -18
    this.compressor.ratio.value = 3
    this.master = ctx.createGain()
    this.master.gain.value = 0.8
    this.tapNode = ctx.createGain()
    this.silence = ctx.createGain()
    this.silence.gain.value = 0

    const reverb = createReverb(ctx)
    this.bus.connect(reverb.input)
    reverb.output.connect(this.compressor)
    this.attachReverb(reverb)

    this.compressor.connect(this.master)
    this.master.connect(ctx.destination)
    this.compressor.connect(this.tapNode)
    this.tapNode.connect(this.silence)
    this.silence.connect(ctx.destination)

    for (const id of CHANNELS) {
      this.mix.set(id, { gain: 1, muted: false })
    }

    for (const id of CHANNELS) {
      this.attachChannel(id, this.createChannel(id))
    }

    this.scheduler = new Scheduler(
      BPM,
      (time, bar) => {
        this.onBarHandler?.(time, bar)
        for (const channel of this.channels.values()) {
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
    this.bus.gain.cancelScheduledValues(this.ctx.currentTime)
    this.bus.gain.setTargetAtTime(1, this.ctx.currentTime, 0.01)
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
    this.bus.gain.cancelScheduledValues(now)
    this.bus.gain.setTargetAtTime(0, now, PAUSE_FADE)
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

  attachChannel(id: ChannelId, channel: InstrumentChannel): void {
    const mixGain = this.ctx.createGain()
    const state = this.mix.get(id) ?? { gain: 1, muted: false }
    mixGain.gain.value = state.muted ? 0 : state.gain
    channel.output.connect(mixGain)
    mixGain.connect(this.bus)
    this.channels.set(id, channel)
    this.mixGains.set(id, mixGain)
  }

  setTimbre(channel: ChannelId, name: TimbreName): void {
    this.timbreChannels.get(channel)?.setTimbre(name)
  }

  setTempo(bpm: number): void {
    this.tempoValue = bpm
    this.scheduler.setBpm(bpm)
  }

  get tempo(): number {
    return this.tempoValue
  }

  get channelCount(): number {
    return this.channels.size
  }

  setProfile(profile: PlaceProfile): void {
    this.setTempo(profile.tempo)
    for (const channel of this.channels.values()) {
      channel.setProfile?.(profile)
    }
  }

  applyTargets(targets: ChannelTargets, tau = 20): void {
    this.channels.get('wind')?.update(targets.wind, tau)
    this.channels.get('rain')?.update(targets.rain, tau)
    this.channels.get('gust')?.update(targets.gust, tau)
    this.channels.get('pressure')?.update(targets.pressure, tau)
    this.channels.get('thunder')?.update(targets.thunder, tau)
    // The v1 pad and motif voices still read a root and a partial count.
    this.channels.get('pad')?.update({ ...targets.pad, root: 38 }, tau)
    this.channels.get('motif')?.update({ ...targets.motif, root: 38, partials: 4 }, tau)
    this.reverb?.setWet(targets.reverb.wet, targets.reverb.preDelay)
  }

  attachReverb(reverb: { setWet(wet: number, preDelay: number): void }): void {
    this.reverb = reverb
  }

  setMix(channel: ChannelId, gain: number, muted: boolean): void {
    this.mix.set(channel, { gain, muted })
    const mixGain = this.mixGains.get(channel)
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
      this.channels.get(eventTarget(event))?.fire?.(event)
    }
  }

  dispose(): void {
    this.cancelPause()
    this.scheduler.stop()
    for (const channel of this.channels.values()) {
      channel.dispose()
    }
    this.channels.clear()
    this.timbreChannels.clear()
    this.mixGains.clear()
  }

  private createChannel(id: ChannelId): InstrumentChannel {
    if (id !== 'pad' && id !== 'motif') {
      return this.createVoice(id, defaultTimbre(id))
    }
    const channel = new TimbreChannel(
      this.ctx,
      (name) => this.createVoice(id, name),
      defaultTimbre(id),
    )
    this.timbreChannels.set(id, channel)
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
