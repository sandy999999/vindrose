import { DORIAN, midiToHz } from '../../domain/harmony'
import type { InstrumentChannel } from '../engine'

interface HumidityTarget {
  level: number
  cutoff: number
  root: number
}

const VOICE_DEGREES = [0, 2, 4]
const BARS_PER_PHRASE = 8

export class HumidityChannel implements InstrumentChannel {
  readonly output: GainNode

  private readonly filter: BiquadFilterNode
  private readonly gain: GainNode
  private readonly voices: OscillatorNode[]
  private root = 38
  private chordIndex = 0

  constructor(private readonly ctx: AudioContext) {
    this.output = ctx.createGain()
    this.gain = ctx.createGain()
    this.gain.gain.value = 0

    this.filter = ctx.createBiquadFilter()
    this.filter.type = 'lowpass'
    this.filter.frequency.value = 800
    this.filter.Q.value = 0.5

    this.voices = [-6, 0, 6].map((detune) => {
      const voice = ctx.createOscillator()
      voice.type = 'triangle'
      voice.detune.value = detune
      voice.connect(this.filter)
      voice.start()
      return voice
    })

    this.filter.connect(this.gain)
    this.gain.connect(this.output)
    this.applyChord(6)
  }

  update(target: unknown, tau: number): void {
    const humidity = target as HumidityTarget
    const now = this.ctx.currentTime
    this.root = humidity.root
    this.gain.gain.setTargetAtTime(humidity.level * 0.22, now, Math.min(tau, 2))
    this.filter.frequency.setTargetAtTime(humidity.cutoff, now, tau)
    this.applyChord(Math.min(tau, 3))
  }

  onBar(_time: number, bar: number): void {
    if (bar % BARS_PER_PHRASE !== 0) return
    this.chordIndex = (this.chordIndex + 1) % DORIAN.length
    this.applyChord(6)
  }

  private applyChord(tau: number): void {
    const now = this.ctx.currentTime
    for (let i = 0; i < this.voices.length; i += 1) {
      const degree = VOICE_DEGREES[i] ?? 0
      const offset = DORIAN[(this.chordIndex + degree) % DORIAN.length] ?? 0
      const note = this.root + 12 + offset
      this.voices[i]?.frequency.setTargetAtTime(midiToHz(note), now, tau)
    }
  }

  dispose(): void {
    for (const voice of this.voices) {
      try {
        voice.stop()
      } catch {
        /* already stopped */
      }
      voice.disconnect()
    }
    this.filter.disconnect()
    this.gain.disconnect()
    this.output.disconnect()
  }
}
