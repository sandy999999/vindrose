import { DORIAN, midiToHz } from '../../domain/harmony'
import type { AudioEvent } from '../../domain/events'
import type { InstrumentChannel } from '../engine'
import type { TimbreName } from '../timbres'

interface TemperatureTarget {
  level: number
  partials: number
  root: number
}

interface Profile {
  type: OscillatorType
  offsets: number[]
  level: number
  lfoRate: number
  lfoDepth: number
}

const MAX_PARTIALS = 6
const BARS_PER_PHRASE = 8

const SHIMMER: Profile = {
  type: 'sine',
  offsets: Array.from({ length: MAX_PARTIALS }, (_, i) => DORIAN[(i * 2) % DORIAN.length] ?? 0),
  level: 0.08,
  lfoRate: 0.07,
  lfoDepth: 0.02,
}

const BELL: Profile = {
  type: 'triangle',
  offsets: [0, 7, 12, 19, 24, 28],
  level: 0.07,
  lfoRate: 0.05,
  lfoDepth: 0.01,
}

const AIR: Profile = {
  type: 'sine',
  offsets: [12, 19, 24, 31, 36, 43],
  level: 0.05,
  lfoRate: 0.18,
  lfoDepth: 0.25,
}

const PROFILES: Record<string, Profile> = { shimmer: SHIMMER, bell: BELL, air: AIR }

export class TemperatureChannel implements InstrumentChannel {
  readonly output: GainNode

  private readonly voices: OscillatorNode[]
  private readonly gains: GainNode[]
  private readonly lfo: OscillatorNode
  private readonly profile: Profile
  private level = 0
  private root = 38
  private partials = 2

  constructor(
    private readonly ctx: AudioContext,
    timbre: TimbreName = 'shimmer',
  ) {
    this.profile = PROFILES[timbre] ?? SHIMMER
    this.output = ctx.createGain()
    this.output.gain.value = 1

    this.voices = []
    this.gains = []

    for (let i = 0; i < MAX_PARTIALS; i += 1) {
      const voice = ctx.createOscillator()
      voice.type = this.profile.type
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
    this.lfo.frequency.value = this.profile.lfoRate
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = this.profile.lfoDepth
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
      const offset = this.profile.offsets[i] ?? 0
      voice.frequency.setTargetAtTime(midiToHz(this.root + 24 + offset), now, tau)
      const active = i < this.partials
      gain.gain.setTargetAtTime(active ? this.level * this.profile.level : 0, now, tau)
    }
  }

  onBar(time: number, bar: number): void {
    if (bar % BARS_PER_PHRASE !== 0) return
    for (let i = 0; i < this.partials; i += 1) {
      const gain = this.gains[i]
      if (!gain) continue
      const peak = Math.max(0.001, this.level * this.profile.level * 1.5)
      gain.gain.cancelScheduledValues(time)
      gain.gain.setValueAtTime(peak, time)
      gain.gain.exponentialRampToValueAtTime(peak * 0.2, time + 6)
    }
  }

  fire(event: AudioEvent): void {
    if (event.type !== 'temperature-note') return
    this.note(event.note)
  }

  private note(midi: number): void {
    const ctx = this.ctx
    const now = ctx.currentTime
    const voice = ctx.createOscillator()
    voice.type = this.profile.type
    voice.frequency.setValueAtTime(midiToHz(midi), now)

    const gain = ctx.createGain()
    const peak = Math.max(0.02, this.level * this.profile.level * 1.5)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.linearRampToValueAtTime(peak, now + 0.03)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.4)

    voice.connect(gain)
    gain.connect(this.output)
    voice.onended = () => {
      voice.disconnect()
      gain.disconnect()
    }

    voice.start(now)
    voice.stop(now + 2.5)
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
