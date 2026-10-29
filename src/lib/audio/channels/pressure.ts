import type { AudioEvent } from '../../domain/events'
import { midiToHz } from '../../domain/harmony'
import type { InstrumentChannel } from '../engine'
import type { TimbreName } from '../timbres'

interface PressureTarget {
  level: number
  index: number
  root: number
}

interface Profile {
  type: OscillatorType
  ratio: number
  index: number
  tone: number
}

const SINE: Profile = { type: 'sine', ratio: 1.5, index: 1, tone: 12000 }
const HOLLOW: Profile = { type: 'triangle', ratio: 1, index: 0.35, tone: 4000 }
const REED: Profile = { type: 'sawtooth', ratio: 2, index: 0.15, tone: 1500 }

const PROFILES: Record<string, Profile> = { sine: SINE, hollow: HOLLOW, reed: REED }

export class PressureChannel implements InstrumentChannel {
  readonly output: GainNode

  private readonly carrier: OscillatorNode
  private readonly modulator: OscillatorNode
  private readonly modGain: GainNode
  private readonly levelGain: GainNode
  private readonly filter: BiquadFilterNode
  private readonly profile: Profile

  constructor(
    private readonly ctx: AudioContext,
    timbre: TimbreName = 'sine',
  ) {
    this.profile = PROFILES[timbre] ?? SINE
    this.output = ctx.createGain()

    this.levelGain = ctx.createGain()
    this.levelGain.gain.value = 0

    this.filter = ctx.createBiquadFilter()
    this.filter.type = 'lowpass'
    this.filter.frequency.value = this.profile.tone

    this.carrier = ctx.createOscillator()
    this.carrier.type = this.profile.type
    this.carrier.frequency.value = midiToHz(38)

    this.modulator = ctx.createOscillator()
    this.modulator.type = 'sine'
    this.modulator.frequency.value = midiToHz(38) * this.profile.ratio

    this.modGain = ctx.createGain()
    this.modGain.gain.value = 0

    this.modulator.connect(this.modGain)
    this.modGain.connect(this.carrier.frequency)
    this.carrier.connect(this.filter)
    this.filter.connect(this.levelGain)
    this.levelGain.connect(this.output)

    this.carrier.start()
    this.modulator.start()
  }

  update(target: unknown, tau: number): void {
    const pressure = target as PressureTarget
    const now = this.ctx.currentTime
    const frequency = midiToHz(pressure.root)
    this.carrier.frequency.setTargetAtTime(frequency, now, 2)
    this.modulator.frequency.setTargetAtTime(frequency * this.profile.ratio, now, 2)
    this.modGain.gain.setTargetAtTime(pressure.index * frequency * this.profile.index, now, tau)
    this.levelGain.gain.setTargetAtTime(pressure.level, now, tau)
  }

  fire(event: AudioEvent): void {
    if (event.type !== 'pressure-glide') return
    const now = this.ctx.currentTime
    const current = this.carrier.frequency.value
    this.carrier.frequency.cancelScheduledValues(now)
    this.carrier.frequency.setValueAtTime(current, now)
    this.carrier.frequency.linearRampToValueAtTime(current * 0.84, now + 4)
    this.carrier.frequency.linearRampToValueAtTime(current, now + 12)
  }

  dispose(): void {
    try {
      this.carrier.stop()
      this.modulator.stop()
    } catch {
      /* already stopped */
    }
    this.carrier.disconnect()
    this.modulator.disconnect()
    this.modGain.disconnect()
    this.filter.disconnect()
    this.levelGain.disconnect()
    this.output.disconnect()
  }
}
