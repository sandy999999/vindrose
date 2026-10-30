import { midiToHz, ROOT_MIDI, scaleNote } from '../../domain/harmony'
import type { Mode, PlaceProfile } from '../../domain/place'
import { mulberry32 } from '../../domain/random'
import type { AudioEvent } from '../../domain/events'
import type { InstrumentChannel } from '../engine'
import { BARS_PER_PHRASE, BEATS_PER_BAR, barDuration } from '../scheduler'
import type { TimbreName } from '../timbres'

interface MotifTarget {
  level: number
  register: number
}

interface Profile {
  type: OscillatorType
  level: number
}

const SHIMMER: Profile = { type: 'sine', level: 0.08 }
const BELL: Profile = { type: 'triangle', level: 0.07 }
const AIR: Profile = { type: 'sine', level: 0.05 }

const PROFILES: Record<string, Profile> = { shimmer: SHIMMER, bell: BELL, air: AIR }

const CONTOUR_A = [2, -1, 1, -2, 0]
const CONTOUR_B = [-2, 1, 2, 0, -1]
const EIGHTHS = BEATS_PER_BAR * 2
const ATTACK = 0.03
const DECAY = 2.4
const REGISTER_SPAN = 5
const DEFAULT_REGISTER = 60

export class MotifChannel implements InstrumentChannel {
  readonly output: GainNode

  private readonly profile: Profile
  private readonly live = new Set<OscillatorNode>()
  private mode: Mode = 'dorian'
  private seed = 0
  private tempo = 56
  private level = 1
  private register = DEFAULT_REGISTER
  private pieceBar = 0

  constructor(
    private readonly ctx: AudioContext,
    timbre: TimbreName = 'shimmer',
  ) {
    this.profile = PROFILES[timbre] ?? SHIMMER
    this.output = ctx.createGain()
    this.output.gain.value = 1
  }

  setProfile(profile: PlaceProfile): void {
    this.mode = profile.mode
    this.seed = profile.seed
    this.tempo = profile.tempo
  }

  update(target: unknown, tau: number): void {
    const motif = target as MotifTarget
    this.level = motif.level
    this.register = motif.register
    // The level rides each note's peak so a phrase never steps mid-decay.
    void tau
  }

  // The scheduler's bar counter restarts whenever the engine resumes, so the
  // voice keeps its own piece bar: one per bar it is told about.
  onBar(time: number, _bar: number): void {
    const bar = this.pieceBar
    this.pieceBar += 1
    if (bar % BARS_PER_PHRASE !== 0) return
    const shape = Math.floor(bar / BARS_PER_PHRASE) % 4
    const rand = mulberry32((this.seed + bar) >>> 0)

    const count = 2 + Math.floor(rand() * 4)
    const positions = [0]
    while (positions.length < count) {
      const position = 1 + Math.floor(rand() * (EIGHTHS - 1))
      if (!positions.includes(position)) positions.push(position)
    }
    positions.sort((a, b) => a - b)

    const contour = shape === 2 ? CONTOUR_B : CONTOUR_A
    const eighth = barDuration(this.tempo) / EIGHTHS
    const baseDegree = this.baseDegree()
    const octave = this.baseOctave()
    let degree = baseDegree

    for (let i = 0; i < positions.length; i += 1) {
      if (i > 0) degree += contour[(i - 1) % contour.length] ?? 0
      const raise = shape === 3 && i === positions.length - 1 ? 1 : 0
      const at = time + (positions[i] ?? 0) * eighth
      this.note(this.pitch(degree, octave, raise), at)
    }
  }

  fire(event: AudioEvent): void {
    if (event.type !== 'temperature-note') return
    this.note(event.note, this.ctx.currentTime)
  }

  private pitch(degree: number, octave: number, raise: number): number {
    const note = scaleNote(this.mode, degree + raise, octave)
    if (Math.abs(note - this.register) <= REGISTER_SPAN) return note
    return scaleNote(this.mode, degree, octave)
  }

  private baseDegree(): number {
    const remainder = (((this.register - ROOT_MIDI) % 12) + 12) % 12
    return Math.round((remainder * 7) / 12)
  }

  private baseOctave(): number {
    return Math.floor((this.register - ROOT_MIDI) / 12)
  }

  private note(midi: number, at: number): void {
    const ctx = this.ctx
    const voice = ctx.createOscillator()
    voice.type = this.profile.type
    voice.frequency.setValueAtTime(midiToHz(midi), at)

    const gain = ctx.createGain()
    const peak = Math.max(0.02, this.level * this.profile.level)
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.linearRampToValueAtTime(peak, at + ATTACK)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + DECAY)

    voice.connect(gain)
    gain.connect(this.output)

    this.live.add(voice)
    voice.onended = () => {
      this.live.delete(voice)
      voice.disconnect()
      gain.disconnect()
    }

    voice.start(at)
    voice.stop(at + DECAY + 0.1)
  }

  dispose(): void {
    for (const voice of this.live) {
      try {
        voice.stop()
      } catch {
        /* already stopped */
      }
      voice.disconnect()
    }
    this.live.clear()
    this.output.disconnect()
  }
}
