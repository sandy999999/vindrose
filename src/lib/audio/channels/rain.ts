import { midiToHz, quantizeToScale } from '../../domain/harmony'
import type { InstrumentChannel } from '../engine'
import { createNoiseBuffer } from '../noise'
import { barDuration } from '../scheduler'

interface RainTarget {
  level: number
  density: number
}

const MAX_GRAINS = 24
const BPM = 56

export class RainChannel implements InstrumentChannel {
  readonly output: GainNode

  private readonly grains: AudioBuffer
  private readonly hissSource: AudioBufferSourceNode
  private readonly hissGain: GainNode
  private level = 0
  private density = 0
  private active = 0

  constructor(private readonly ctx: AudioContext) {
    this.output = ctx.createGain()
    this.output.gain.value = 0

    this.grains = createNoiseBuffer(ctx, 1, 1)

    this.hissSource = ctx.createBufferSource()
    this.hissSource.buffer = createNoiseBuffer(ctx, 4, 1)
    this.hissSource.loop = true

    const highpass = ctx.createBiquadFilter()
    highpass.type = 'highpass'
    highpass.frequency.value = 4000

    this.hissGain = ctx.createGain()
    this.hissGain.gain.value = 0

    this.hissSource.connect(highpass)
    highpass.connect(this.hissGain)
    this.hissGain.connect(this.output)
    this.hissSource.start()
  }

  update(target: unknown, tau: number): void {
    const rain = target as RainTarget
    this.level = rain.level
    this.density = rain.density
    const now = this.ctx.currentTime
    this.output.gain.setTargetAtTime(rain.level * 0.7, now, tau)
    const hiss = rain.density > 0.4 ? (rain.density - 0.4) * 0.25 : 0
    this.hissGain.gain.setTargetAtTime(hiss, now, tau)
  }

  onBar(time: number): void {
    const count = Math.min(MAX_GRAINS, Math.round(this.density * 40))
    const span = barDuration(BPM)
    for (let i = 0; i < count; i += 1) {
      this.grain(time + Math.random() * span)
    }
  }

  private grain(at: number): void {
    if (this.active >= MAX_GRAINS) return
    const ctx = this.ctx
    const source = ctx.createBufferSource()
    source.buffer = this.grains

    const duration = 0.03 + Math.random() * 0.05
    const offset = Math.random() * (1 - duration - 0.01)

    const band = ctx.createBiquadFilter()
    band.type = 'bandpass'
    band.Q.value = 6
    band.frequency.value = midiToHz(quantizeToScale(72 + Math.floor(Math.random() * 12)))

    const envelope = ctx.createGain()
    envelope.gain.setValueAtTime(0.0001, at)
    envelope.gain.linearRampToValueAtTime(0.35, at + 0.01)
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration)

    const panner = ctx.createStereoPanner()
    panner.pan.value = Math.random() * 1.4 - 0.7

    source.connect(band)
    band.connect(envelope)
    envelope.connect(panner)
    panner.connect(this.output)

    this.active += 1
    source.onended = () => {
      this.active -= 1
      source.disconnect()
      band.disconnect()
      envelope.disconnect()
      panner.disconnect()
    }

    source.start(at, offset, duration + 0.01)
    source.stop(at + duration + 0.01)
  }

  dispose(): void {
    try {
      this.hissSource.stop()
    } catch {
      /* already stopped */
    }
    this.hissSource.disconnect()
    this.hissGain.disconnect()
    this.output.disconnect()
  }
}
