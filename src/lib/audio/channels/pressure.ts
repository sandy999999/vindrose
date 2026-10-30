import type { AudioEvent } from '../../domain/events'
import type { InstrumentChannel } from '../engine'
import { createNoiseBuffer } from '../noise'

interface PressureTarget {
  level: number
  targetHz: number
}

const FEEDBACK = 0.93
const GLIDE_DROP = 0.95
const GLIDE_SECONDS = 8
const EXCITER_LEVEL = 0.06
const INITIAL_HZ = 110

export class PressureChannel implements InstrumentChannel {
  readonly output: GainNode

  private readonly feedback: GainNode
  private readonly delay: DelayNode
  private readonly lowpass: BiquadFilterNode
  private readonly levelGain: GainNode
  private readonly exciter: AudioBufferSourceNode
  private readonly exciterGain: GainNode
  private targetHz = INITIAL_HZ

  constructor(private readonly ctx: AudioContext) {
    // The feedback gain is the first gain node so the loop's identity is
    // readable from construction order.
    this.feedback = ctx.createGain()
    this.feedback.gain.value = FEEDBACK

    this.output = ctx.createGain()
    this.output.gain.value = 0

    this.levelGain = ctx.createGain()
    this.levelGain.gain.value = 0

    this.delay = ctx.createDelay(1)
    this.delay.delayTime.value = 1 / this.targetHz

    this.lowpass = ctx.createBiquadFilter()
    this.lowpass.type = 'lowpass'
    this.lowpass.frequency.value = 0.5 * this.targetHz

    this.exciter = ctx.createBufferSource()
    this.exciter.buffer = createNoiseBuffer(ctx, 2)
    this.exciter.loop = true

    this.exciterGain = ctx.createGain()
    this.exciterGain.gain.value = EXCITER_LEVEL

    this.exciter.connect(this.exciterGain)
    this.exciterGain.connect(this.delay)
    this.delay.connect(this.lowpass)
    this.lowpass.connect(this.feedback)
    this.feedback.connect(this.delay)
    this.lowpass.connect(this.levelGain)
    this.levelGain.connect(this.output)

    this.exciter.start()
  }

  update(target: unknown, tau: number): void {
    const pressure = target as PressureTarget
    this.targetHz = pressure.targetHz
    const now = this.ctx.currentTime
    this.delay.delayTime.setTargetAtTime(1 / pressure.targetHz, now, GLIDE_SECONDS)
    this.lowpass.frequency.setTargetAtTime(0.5 * pressure.targetHz, now, GLIDE_SECONDS)
    this.levelGain.gain.setTargetAtTime(pressure.level, now, tau)
  }

  fire(event: AudioEvent): void {
    if (event.type !== 'pressure-glide') return
    const now = this.ctx.currentTime
    const bent = this.targetHz * GLIDE_DROP
    this.delay.delayTime.cancelScheduledValues(now)
    this.delay.delayTime.setValueAtTime(this.delay.delayTime.value, now)
    this.delay.delayTime.linearRampToValueAtTime(1 / bent, now + GLIDE_SECONDS)
  }

  dispose(): void {
    try {
      this.exciter.stop()
    } catch {
      /* already stopped */
    }
    this.exciter.disconnect()
    this.exciterGain.disconnect()
    this.delay.disconnect()
    this.lowpass.disconnect()
    this.feedback.disconnect()
    this.levelGain.disconnect()
    this.output.disconnect()
  }
}
