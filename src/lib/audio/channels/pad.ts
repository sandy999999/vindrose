import { midiToHz, scaleNote } from '../../domain/harmony'
import type { Mode, PlaceProfile } from '../../domain/place'
import type { InstrumentChannel } from '../engine'
import type { TimbreName } from '../timbres'

interface PadTarget {
  level: number
  cutoff: number
  degree: number
}

interface Profile {
  type: OscillatorType
  detunes: [number, number, number]
  octave: number
  q: number
  cutoffScale: number
  level: number
}

const PAD: Profile = { type: 'triangle', detunes: [-6, 0, 6], octave: 0, q: 0.5, cutoffScale: 1, level: 0.22 }
const CHOIR: Profile = { type: 'sine', detunes: [-14, 0, 14], octave: 0, q: 1.2, cutoffScale: 1.8, level: 0.34 }
const GLASS: Profile = { type: 'sine', detunes: [-40, 0, 40], octave: 12, q: 6, cutoffScale: 3.2, level: 0.16 }

const PROFILES: Record<string, Profile> = { pad: PAD, choir: CHOIR, glass: GLASS }

const VOICE_DEGREES = [0, 2, 4]
const PAD_OCTAVE = 1
const DEFAULT_MODE: Mode = 'dorian'

export class PadChannel implements InstrumentChannel {
  readonly output: GainNode

  private readonly filter: BiquadFilterNode
  private readonly gain: GainNode
  private readonly voices: OscillatorNode[]
  private readonly profile: Profile
  private mode: Mode = DEFAULT_MODE
  private degree = 0

  constructor(
    private readonly ctx: AudioContext,
    timbre: TimbreName = 'pad',
  ) {
    this.profile = PROFILES[timbre] ?? PAD
    this.output = ctx.createGain()
    this.gain = ctx.createGain()
    this.gain.gain.value = 0

    this.filter = ctx.createBiquadFilter()
    this.filter.type = 'lowpass'
    this.filter.frequency.value = 800 * this.profile.cutoffScale
    this.filter.Q.value = this.profile.q

    this.voices = this.profile.detunes.map((detune) => {
      const voice = ctx.createOscillator()
      voice.type = this.profile.type
      voice.detune.value = detune
      voice.connect(this.filter)
      voice.start()
      return voice
    })

    this.filter.connect(this.gain)
    this.gain.connect(this.output)
    this.applyChord(6)
  }

  setProfile(profile: PlaceProfile): void {
    this.mode = profile.mode
    this.applyChord(2)
  }

  update(target: unknown, tau: number): void {
    const pad = target as PadTarget
    const now = this.ctx.currentTime
    this.gain.gain.setTargetAtTime(pad.level * this.profile.level, now, Math.min(tau, 2))
    this.filter.frequency.setTargetAtTime(pad.cutoff * this.profile.cutoffScale, now, tau)
    this.degree = pad.degree
    this.applyChord(Math.min(tau, 3))
  }

  private applyChord(tau: number): void {
    const now = this.ctx.currentTime
    for (let i = 0; i < this.voices.length; i += 1) {
      const offset = VOICE_DEGREES[i] ?? 0
      const note = scaleNote(this.mode, this.degree + offset, PAD_OCTAVE) + this.profile.octave
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
