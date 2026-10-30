import type { AudioEvent } from '../../domain/events'
import type { InstrumentChannel } from '../engine'
import { createNoiseBuffer } from '../noise'

const MAX_VOICES = 24
const SWEEP_START = 1800
const SWEEP_END = 300
const MIN_BURST = 0.3
const MAX_BURST = 0.8
const THUMP_LOW = 40
const THUMP_SPAN = 50
const THUMP_LEVEL = 0.35

export class GustChannel implements InstrumentChannel {
  readonly output: GainNode

  private readonly noise: AudioBuffer
  private active = 0

  constructor(private readonly ctx: AudioContext) {
    this.output = ctx.createGain()
    this.output.gain.value = 0.9
    this.noise = createNoiseBuffer(ctx, 1)
  }

  fire(event: AudioEvent): void {
    if (event.type !== 'gust-burst') return
    const count = 3 + Math.round(event.strength * 9)
    const now = this.ctx.currentTime

    for (let i = 0; i < count; i += 1) {
      if (this.active >= MAX_VOICES) return
      const at = now + (i / count) * 0.6 + Math.random() * 0.01
      this.burst(at, event.strength * (0.6 + Math.random() * 0.4))
    }
  }

  update(): void {
    /* the gust cloud is event driven */
  }

  private burst(at: number, strength: number): void {
    const ctx = this.ctx
    const duration = MIN_BURST + Math.random() * (MAX_BURST - MIN_BURST)

    const source = ctx.createBufferSource()
    source.buffer = this.noise

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.Q.value = 1.2
    filter.frequency.setValueAtTime(SWEEP_START, at)
    filter.frequency.exponentialRampToValueAtTime(SWEEP_END, at + duration)

    const envelope = ctx.createGain()
    envelope.gain.setValueAtTime(0.0001, at)
    envelope.gain.linearRampToValueAtTime(strength, at + duration * 0.35)
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration)

    const panner = ctx.createStereoPanner()
    panner.pan.value = Math.random() * 2 - 1

    const thumpHz = THUMP_LOW + Math.random() * THUMP_SPAN
    const thump = ctx.createOscillator()
    thump.type = 'sine'
    thump.frequency.setValueAtTime(thumpHz, at)
    thump.frequency.exponentialRampToValueAtTime(thumpHz * 0.7, at + 0.2)

    const thumpGain = ctx.createGain()
    thumpGain.gain.setValueAtTime(0.0001, at)
    thumpGain.gain.linearRampToValueAtTime(strength * THUMP_LEVEL, at + 0.01)
    thumpGain.gain.exponentialRampToValueAtTime(0.0001, at + 0.25)

    source.connect(filter)
    filter.connect(envelope)
    envelope.connect(panner)
    thump.connect(thumpGain)
    thumpGain.connect(panner)
    panner.connect(this.output)

    this.active += 1
    source.onended = () => {
      this.active -= 1
      source.disconnect()
      filter.disconnect()
      envelope.disconnect()
      thump.disconnect()
      thumpGain.disconnect()
      panner.disconnect()
    }

    source.start(at)
    source.stop(at + duration)
    thump.start(at)
    thump.stop(at + 0.3)
  }

  dispose(): void {
    this.output.disconnect()
  }
}
