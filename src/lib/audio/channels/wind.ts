import type { AudioEvent } from '../../domain/events'
import type { InstrumentChannel } from '../engine'
import { createNoiseBuffer } from '../noise'
import type { TimbreName } from '../timbres'

interface WindTarget {
  level: number
  cutoff: number
  pan: number
}

interface Profile {
  type: BiquadFilterType
  q: number
  scale: number
  level: number
}

const HISS: Profile = { type: 'bandpass', q: 0.7, scale: 1, level: 0.5 }
const ROAR: Profile = { type: 'lowpass', q: 1.4, scale: 0.4, level: 0.62 }
const WHISTLE: Profile = { type: 'bandpass', q: 9, scale: 2.6, level: 0.72 }

const PROFILES: Record<string, Profile> = { hiss: HISS, roar: ROAR, whistle: WHISTLE }

export class WindChannel implements InstrumentChannel {
  readonly output: GainNode

  private readonly filter: BiquadFilterNode
  private readonly panner: StereoPannerNode
  private readonly source: AudioBufferSourceNode
  private readonly sweepNoise: AudioBuffer
  private readonly profile: Profile

  constructor(
    private readonly ctx: AudioContext,
    timbre: TimbreName = 'hiss',
  ) {
    this.profile = PROFILES[timbre] ?? HISS

    this.output = ctx.createGain()
    this.output.gain.value = 0

    this.filter = ctx.createBiquadFilter()
    this.filter.type = this.profile.type
    this.filter.frequency.value = 200 * this.profile.scale
    this.filter.Q.value = this.profile.q

    this.panner = ctx.createStereoPanner()

    this.source = ctx.createBufferSource()
    this.source.buffer = createNoiseBuffer(ctx, 4)
    this.source.loop = true

    this.sweepNoise = createNoiseBuffer(ctx, 1.5)

    this.source.connect(this.filter)
    this.filter.connect(this.panner)
    this.panner.connect(this.output)
    this.source.start()
  }

  update(target: unknown, tau: number): void {
    const wind = target as WindTarget
    const now = this.ctx.currentTime
    this.output.gain.setTargetAtTime(wind.level * this.profile.level, now, tau)
    this.filter.frequency.setTargetAtTime(wind.cutoff * this.profile.scale, now, tau)
    this.panner.pan.setTargetAtTime(wind.pan, now, tau)
  }

  fire(event: AudioEvent): void {
    if (event.type !== 'direction-sweep') return
    const ctx = this.ctx
    const now = ctx.currentTime

    const source = ctx.createBufferSource()
    source.buffer = this.sweepNoise

    const band = ctx.createBiquadFilter()
    band.type = 'bandpass'
    band.Q.value = Math.max(2, this.profile.q)
    band.frequency.value = this.filter.frequency.value * 1.5

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.linearRampToValueAtTime(0.12, now + 0.3)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.4)

    const panner = ctx.createStereoPanner()
    panner.pan.setValueAtTime(-event.pan, now)
    panner.pan.linearRampToValueAtTime(event.pan, now + 1.1)

    source.connect(band)
    band.connect(gain)
    gain.connect(panner)
    panner.connect(this.output)

    source.onended = () => {
      source.disconnect()
      band.disconnect()
      gain.disconnect()
      panner.disconnect()
    }

    source.start(now)
    source.stop(now + 1.5)
  }

  dispose(): void {
    try {
      this.source.stop()
    } catch {
      /* already stopped */
    }
    this.source.disconnect()
    this.filter.disconnect()
    this.panner.disconnect()
    this.output.disconnect()
  }
}
