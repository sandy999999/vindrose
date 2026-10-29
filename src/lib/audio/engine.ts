import type { ChannelTargets } from '../domain/mapping'
import type { AudioEvent } from '../domain/events'
import { Scheduler } from './scheduler'
import { WindChannel } from './channels/wind'
import { GustChannel } from './channels/gust'
import { RainChannel } from './channels/rain'
import { PressureChannel } from './channels/pressure'
import { HumidityChannel } from './channels/humidity'
import { TemperatureChannel } from './channels/temperature'
import { createReverb } from './reverb'

export type ChannelId = 'wind' | 'gust' | 'rain' | 'pressure' | 'humidity' | 'temperature'

export interface InstrumentChannel {
  readonly output: GainNode
  update(target: unknown, tau: number): void
  fire?(event: AudioEvent): void
  onBar?(time: number, bar: number): void
  dispose(): void
}

export const CHANNELS: ChannelId[] = [
  'wind',
  'gust',
  'rain',
  'pressure',
  'humidity',
  'temperature',
]

export const BPM = 56

interface MixState {
  gain: number
  muted: boolean
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
  private readonly mixGains = new Map<ChannelId, GainNode>()
  private readonly mix = new Map<ChannelId, MixState>()
  private started = false
  private frozen = false
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

    this.attachChannel('wind', new WindChannel(ctx))
    this.attachChannel('gust', new GustChannel(ctx))
    this.attachChannel('rain', new RainChannel(ctx))
    this.attachChannel('pressure', new PressureChannel(ctx))
    this.attachChannel('humidity', new HumidityChannel(ctx))
    this.attachChannel('temperature', new TemperatureChannel(ctx))

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
    await this.resume()
    if (!this.started) {
      this.started = true
      this.scheduler.start(this.ctx.currentTime)
    }
  }

  stop(): void {
    this.scheduler.stop()
    this.started = false
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

  applyTargets(targets: ChannelTargets, tau = 20): void {
    this.channels.get('wind')?.update(targets.wind, tau)
    this.channels.get('gust')?.update(targets.gust, tau)
    this.channels.get('rain')?.update(targets.rain, tau)
    this.channels.get('pressure')?.update(targets.pressure, tau)
    this.channels.get('humidity')?.update(targets.humidity, tau)
    this.channels.get('temperature')?.update(targets.temperature, tau)
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
    this.master.gain.setTargetAtTime(value, this.ctx.currentTime, 0.05)
  }

  setFrozen(frozen: boolean): void {
    this.frozen = frozen
  }

  fire(events: AudioEvent[]): void {
    if (this.frozen) return
    for (const event of events) {
      for (const channel of this.channels.values()) {
        channel.fire?.(event)
      }
    }
  }

  dispose(): void {
    this.scheduler.stop()
    for (const channel of this.channels.values()) {
      channel.dispose()
    }
    this.channels.clear()
    this.mixGains.clear()
  }
}
