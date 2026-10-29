import type { AudioEvent } from '../../domain/events'
import { midiToHz, quantizeToScale } from '../../domain/harmony'
import type { InstrumentChannel } from '../engine'
import { createNoiseBuffer } from '../noise'
import type { TimbreName } from '../timbres'

const MAX_VOICES = 24

export class GustChannel implements InstrumentChannel {
  readonly output: GainNode

  private readonly noise: AudioBuffer
  private active = 0

  constructor(
    private readonly ctx: AudioContext,
    private readonly timbre: TimbreName = 'ping',
  ) {
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

    const filter = ctx.createBiquadFilter()
    const envelope = ctx.createGain()
    const panner = ctx.createStereoPanner()
    panner.pan.value = Math.random() * 2 - 1

    const ping = ctx.createOscillator()
    const pingGain = ctx.createGain()

    source.connect(filter)
    filter.connect(envelope)
    envelope.connect(panner)
    ping.connect(pingGain)
    pingGain.connect(panner)
    panner.connect(this.output)

    let stopAt = at + 0.13

    if (this.timbre === 'tick') {
      filter.type = 'highpass'
      filter.frequency.value = 3200
      envelope.gain.setValueAtTime(0.0001, at)
      envelope.gain.linearRampToValueAtTime(0.55, at + 0.001)
      envelope.gain.exponentialRampToValueAtTime(0.0001, at + 0.03)
      pingGain.gain.value = 0
      stopAt = at + 0.04
    } else if (this.timbre === 'wood') {
      const base = midiToHz(quantizeToScale(62 + Math.floor(Math.random() * 12)))
      filter.type = 'bandpass'
      filter.frequency.value = 900
      filter.Q.value = 6
      envelope.gain.setValueAtTime(0.0001, at)
      envelope.gain.linearRampToValueAtTime(0.7, at + 0.002)
      envelope.gain.exponentialRampToValueAtTime(0.0001, at + 0.05)
      ping.type = 'triangle'
      ping.frequency.setValueAtTime(base, at)
      ping.frequency.exponentialRampToValueAtTime(base * 0.94, at + 0.09)
      pingGain.gain.setValueAtTime(0.0001, at)
      pingGain.gain.linearRampToValueAtTime(0.3, at + 0.002)
      pingGain.gain.exponentialRampToValueAtTime(0.0001, at + 0.1)
      stopAt = at + 0.12
    } else {
      filter.type = 'highpass'
      filter.frequency.value = 1200
      envelope.gain.setValueAtTime(0.001, at)
      envelope.gain.linearRampToValueAtTime(0.8, at + 0.001)
      envelope.gain.exponentialRampToValueAtTime(0.001, at + 0.06)
      ping.type = 'sine'
      ping.frequency.value = midiToHz(quantizeToScale(72 + Math.floor(Math.random() * 12)))
      pingGain.gain.setValueAtTime(0.0001, at)
      pingGain.gain.linearRampToValueAtTime(0.25, at + 0.002)
      pingGain.gain.exponentialRampToValueAtTime(0.0001, at + 0.12)
      stopAt = at + 0.13
    }

    this.active += 1
    source.onended = () => {
      this.active -= 1
      source.disconnect()
      filter.disconnect()
      envelope.disconnect()
      ping.disconnect()
      pingGain.disconnect()
      panner.disconnect()
    }

    source.start(at)
    source.stop(stopAt)
    ping.start(at)
    ping.stop(stopAt)
  }

  dispose(): void {
    this.output.disconnect()
  }
}
