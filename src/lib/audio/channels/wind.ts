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
