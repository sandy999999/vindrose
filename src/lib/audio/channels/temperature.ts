import { DORIAN, midiToHz } from '../../domain/harmony'
import type { InstrumentChannel } from '../engine'

interface TemperatureTarget {
  level: number
  partials: number
  root: number
}

const MAX_PARTIALS = 6
const BARS_PER_PHRASE = 8

export class TemperatureChannel implements InstrumentChannel {
  readonly output: GainNode

  private readonly voices: OscillatorNode[]
  private readonly gains: GainNode[]
  private readonly lfo: OscillatorNode
  private level = 0
  private root = 38
  private partials = 2

  constructor(private readonly ctx: AudioContext) {
    this.output = ctx.createGain()
    this.output.gain.value = 1

    this.voices = []
    this.gains = []

    for (let i = 0; i < MAX_PARTIALS; i += 1) {
      const voice = ctx.createOscillator()
      voice.type = 'sine'
      const gain = ctx.createGain()
      gain.gain.value = 0
      voice.connect(gain)
      gain.connect(this.output)
      voice.start()
      this.voices.push(voice)
      this.gains.push(gain)
    }

    this.lfo = ctx.createOscillator()
    this.lfo.type = 'sine'
    this.lfo.frequency.value = 0.07
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 0.02
    this.lfo.connect(lfoGain)
    lfoGain.connect(this.output.gain)
    this.lfo.start()
  }

  update(target: unknown, tau: number): void {
    const temperature = target as TemperatureTarget
    const now = this.ctx.currentTime
    this.level = temperature.level
    this.root = temperature.root
    this.partials = Math.max(2, Math.min(MAX_PARTIALS, temperature.partials))

    for (let i = 0; i < MAX_PARTIALS; i += 1) {
      const voice = this.voices[i]
      const gain = this.gains[i]
      if (!voice || !gain) continue
      const offset = DORIAN[(i * 2) % DORIAN.length] ?? 0
      voice.frequency.setTargetAtTime(midiToHz(this.root + 24 + offset), now, tau)
      const active = i < this.partials
      gain.gain.setTargetAtTime(active ? this.level * 0.08 : 0, now, tau)
    }
  }

  onBar(time: number, bar: number): void {
    if (bar % BARS_PER_PHRASE !== 0) return
    for (let i = 0; i < this.partials; i += 1) {
      const gain = this.gains[i]
      if (!gain) continue
      const peak = Math.max(0.001, this.level * 0.12)
      gain.gain.cancelScheduledValues(time)
      gain.gain.setValueAtTime(peak, time)
      gain.gain.exponentialRampToValueAtTime(peak * 0.2, time + 6)
    }
  }

  dispose(): void {
    try {
      this.lfo.stop()
    } catch {
      /* already stopped */
    }
    for (const voice of this.voices) {
      try {
        voice.stop()
      } catch {
        /* already stopped */
      }
      voice.disconnect()
    }
    for (const gain of this.gains) {
      gain.disconnect()
    }
    this.lfo.disconnect()
    this.output.disconnect()
  }
}
