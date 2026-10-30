import type { InstrumentChannel } from '../engine'

export class SilentChannel implements InstrumentChannel {
  readonly output: GainNode

  constructor(ctx: AudioContext) {
    this.output = ctx.createGain()
    this.output.gain.value = 0
  }

  update(): void {}

  dispose(): void {}
}
