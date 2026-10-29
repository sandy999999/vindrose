import type { InstrumentChannel } from '../engine'
import { createNoiseBuffer } from '../noise'

interface WindTarget {
  level: number
  cutoff: number
  pan: number
}

export class WindChannel implements InstrumentChannel {
  readonly output: GainNode

  private readonly filter: BiquadFilterNode
  private readonly panner: StereoPannerNode
  private readonly source: AudioBufferSourceNode

  constructor(private readonly ctx: AudioContext) {
    this.output = ctx.createGain()
    this.output.gain.value = 0

    this.filter = ctx.createBiquadFilter()
    this.filter.type = 'bandpass'
    this.filter.frequency.value = 200
    this.filter.Q.value = 0.7

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
    this.output.gain.setTargetAtTime(wind.level * 0.5, now, tau)
    this.filter.frequency.setTargetAtTime(wind.cutoff, now, tau)
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
