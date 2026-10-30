import type { Material } from '../../domain/place'
import { MATERIAL_SPEC } from '../../domain/materials'
import type { AudioEvent, RainState } from '../../domain/events'
import type { PlaceProfile } from '../../domain/place'
import type { InstrumentChannel } from '../engine'
import { createNoiseBuffer } from '../noise'

interface RainTarget {
  level: number
  density: number
  basePitch: number
}

const DROP_HORIZON = 6
const DROP_Q = 40
const DROP_PEAK = 0.5
const MIN_DROP = 0.008
const MAX_DROP = 0.03
const MAX_GRAINS = 24

export function rainBurstCount(state: RainState): number {
  switch (state) {
    case 'dry':
      return 0
    case 'drizzle':
      return 3
    case 'rain':
      return 6
    case 'heavy':
      return 10
  }
}

export class RainChannel implements InstrumentChannel {
  readonly output: GainNode

  private readonly impulse: AudioBuffer
  private readonly modes: BiquadFilterNode[] = []
  private material: Material
  private ratios: [number, number, number, number]
  private basePitch = 220
  private density = 0
  private scheduledUntil = 0
  private active = 0

  constructor(
    private readonly ctx: AudioContext,
    material: Material = 'wood',
  ) {
    this.material = material
    this.ratios = MATERIAL_SPEC[material].ratios
    this.output = ctx.createGain()
    this.output.gain.value = 0
    this.impulse = createNoiseBuffer(ctx, 0.05)

    for (const ratio of this.ratios) {
      const mode = ctx.createBiquadFilter()
      mode.type = 'bandpass'
      mode.frequency.value = this.basePitch * ratio
      mode.Q.value = DROP_Q
      mode.connect(this.output)
      this.modes.push(mode)
    }
  }

  update(target: unknown, tau: number): void {
    const rain = target as RainTarget
    const now = this.ctx.currentTime
    this.output.gain.setTargetAtTime(rain.level, now, tau)
    this.density = rain.density
    this.tune(rain.basePitch, tau)
    this.scheduleDrops(now)
  }

  setProfile(profile: PlaceProfile): void {
    if (profile.material === this.material) return
    this.material = profile.material
    this.ratios = MATERIAL_SPEC[profile.material].ratios
    for (let i = 0; i < this.modes.length; i += 1) {
      this.modes[i]?.frequency.setTargetAtTime(
        this.basePitch * (this.ratios[i] ?? 1),
        this.ctx.currentTime,
        0.2,
      )
    }
  }

  fire(event: AudioEvent): void {
    if (event.type !== 'rain-change') return
    const count = rainBurstCount(event.state)
    const now = this.ctx.currentTime
    for (let i = 0; i < count; i += 1) {
      this.drop(now + Math.random() * 0.8)
    }
  }

  private tune(basePitch: number, tau: number): void {
    this.basePitch = basePitch
    const now = this.ctx.currentTime
    for (let i = 0; i < this.modes.length; i += 1) {
      this.modes[i]?.frequency.setTargetAtTime(basePitch * (this.ratios[i] ?? 1), now, tau)
    }
  }

  private scheduleDrops(now: number): void {
    const from = Math.max(now, this.scheduledUntil)
    const until = now + DROP_HORIZON
    const spacing = 1 / (2 + 40 * this.density)
    for (let at = from; at < until; at += spacing) {
      this.drop(at + Math.random() * spacing)
    }
    this.scheduledUntil = until
  }

  private drop(at: number): void {
    if (this.active >= MAX_GRAINS) return
    const ctx = this.ctx
    const duration = MIN_DROP + Math.random() * (MAX_DROP - MIN_DROP)

    const source = ctx.createBufferSource()
    source.buffer = this.impulse

    const envelope = ctx.createGain()
    envelope.gain.setValueAtTime(0.0001, at)
    envelope.gain.linearRampToValueAtTime(DROP_PEAK, at + 0.004)
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration)

    const panner = ctx.createStereoPanner()
    panner.pan.value = Math.random() * 1.4 - 0.7

    source.connect(envelope)
    envelope.connect(panner)
    for (const mode of this.modes) {
      panner.connect(mode)
    }

    this.active += 1
    source.onended = () => {
      this.active -= 1
      source.disconnect()
      envelope.disconnect()
      panner.disconnect()
    }

    const offset = Math.random() * (0.05 - duration - 0.002)
    source.start(at, offset, duration)
    source.stop(at + duration)
  }

  dispose(): void {
    for (const mode of this.modes) {
      mode.disconnect()
    }
    this.output.disconnect()
  }
}
