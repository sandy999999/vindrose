import type { AudioEvent } from '../../domain/events'
import { midiToHz, quantizeToScale } from '../../domain/harmony'
import type { InstrumentChannel } from '../engine'
import { createNoiseBuffer } from '../noise'

const MAX_VOICES = 24

export class GustChannel implements InstrumentChannel {
  readonly output: GainNode

  private readonly noise: AudioBuffer
  private active = 0

  constructor(private readonly ctx: AudioContext) {
    this.output = ctx.createGain()
    this.output.gain.value = 0.9
    this.noise = createNoiseBuffer(ctx, 0.02, 1)
  }

  fire(event: AudioEvent): void {
    if (event.type !== 'gust-burst') return
    const count = 3 + Math.round(event.strength * 9)
    const now = this.ctx.currentTime

    for (let i = 0; i < count; i += 1) {
      if (this.active >= MAX_VOICES) return
      const at = now + (i / count) * 0.6 + Math.random() * 0.01
      this.click(at)
    }
  }

  update(): void {
    /* the gust cloud is event driven */
  }

  private click(at: number): void {
    const ctx = this.ctx
    const source = ctx.createBufferSource()
    source.buffer = this.noise

    const highpass = ctx.createBiquadFilter()
    highpass.type = 'highpass'
    highpass.frequency.value = 1200

    const envelope = ctx.createGain()
    envelope.gain.setValueAtTime(0.001, at)
    envelope.gain.linearRampToValueAtTime(0.8, at + 0.001)
    envelope.gain.exponentialRampToValueAtTime(0.001, at + 0.06)

    const panner = ctx.createStereoPanner()
    panner.pan.value = Math.random() * 2 - 1

    const ping = ctx.createOscillator()
    ping.type = 'sine'
    ping.frequency.value = midiToHz(quantizeToScale(72 + Math.floor(Math.random() * 12)))

    const pingGain = ctx.createGain()
    pingGain.gain.setValueAtTime(0.0001, at)
    pingGain.gain.linearRampToValueAtTime(0.25, at + 0.002)
    pingGain.gain.exponentialRampToValueAtTime(0.0001, at + 0.12)

    source.connect(highpass)
    highpass.connect(envelope)
    envelope.connect(panner)
    ping.connect(pingGain)
    pingGain.connect(panner)
    panner.connect(this.output)

    this.active += 1
    source.onended = () => {
      this.active -= 1
      source.disconnect()
      highpass.disconnect()
      envelope.disconnect()
      ping.disconnect()
      pingGain.disconnect()
      panner.disconnect()
    }

    source.start(at)
    source.stop(at + 0.13)
    ping.start(at)
    ping.stop(at + 0.13)
  }

  dispose(): void {
    this.output.disconnect()
  }
}
