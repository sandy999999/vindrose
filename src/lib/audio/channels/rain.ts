import type { Material } from '../../domain/place'
import { MATERIAL_SPEC } from '../../domain/materials'
import type { AudioEvent, RainState } from '../../domain/events'
import type { PlaceProfile } from '../../domain/place'
import { clamp } from '../../domain/units'
import type { InstrumentChannel } from '../engine'
import { createNoiseBuffer } from '../noise'
import {
  dropEnergy,
  dropRate,
  dropTone,
  hissLevel,
  sampleDiameter,
} from '../rainModel'

interface RainTarget {
  level: number
  density: number
  rate?: number
  basePitch: number
}

const DROP_HORIZON = 6
const DROP_Q = 40
const HIT_Q = 0.9
const MIN_DROP = 0.006
const MAX_DROP = 0.04
const MAX_GRAINS = 24
const AIR_LEVEL = 0.5
const HISS_HZ = 4500
const REFERENCE_ENERGY = dropEnergy(1)

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
  private readonly hiss: AudioBufferSourceNode
  private readonly hissGain: GainNode
  private material: Material
  private ratios: [number, number, number, number]
  private basePitch = 220
  private rateMmH = 0
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

    this.hiss = ctx.createBufferSource()
    this.hiss.buffer = createNoiseBuffer(ctx, 3)
    this.hiss.loop = true
    const highpass = ctx.createBiquadFilter()
    highpass.type = 'highpass'
    highpass.frequency.value = HISS_HZ
    highpass.Q.value = 0.7
    this.hissGain = ctx.createGain()
    this.hissGain.gain.value = 0
    this.hiss.connect(highpass)
    highpass.connect(this.hissGain)
    this.hissGain.connect(this.output)
    this.hiss.start()
  }

  update(target: unknown, tau: number): void {
    const rain = target as RainTarget
    const now = this.ctx.currentTime
    // Older targets carried only the normalised density; ten mm per hour is
    // full scale, so it recovers the rate.
    this.rateMmH = Math.max(0, rain.rate ?? rain.density * 10)
    this.output.gain.setTargetAtTime(rain.level, now, tau)
    this.hissGain.gain.setTargetAtTime(hissLevel(this.rateMmH), now, tau)
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
    const perSecond = dropRate(this.rateMmH)
    if (perSecond <= 0) return
    const from = Math.max(now, this.scheduledUntil)
    const until = now + DROP_HORIZON
    const spacing = 1 / perSecond
    for (let at = from; at < until; at += spacing) {
      this.drop(at + Math.random() * spacing)
    }
    this.scheduledUntil = until
  }

  private drop(at: number): void {
    if (this.active >= MAX_GRAINS) return
    const ctx = this.ctx
    const diameter = sampleDiameter(this.rateMmH, Math.random())
    const duration = clamp(MIN_DROP + 0.004 * diameter, MIN_DROP, MAX_DROP)
    const energy = dropEnergy(diameter) / REFERENCE_ENERGY
    const peak = clamp(0.22 * Math.pow(energy, 0.25), 0.02, 0.9)

    const source = ctx.createBufferSource()
    source.buffer = this.impulse

    // Each drop excites the surface with a band centred on its size.
    const band = ctx.createBiquadFilter()
    band.type = 'bandpass'
    band.frequency.value = dropTone(diameter)
    band.Q.value = HIT_Q

    const envelope = ctx.createGain()
    envelope.gain.setValueAtTime(0.0001, at)
    envelope.gain.linearRampToValueAtTime(peak, at + 0.003)
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration)

    const panner = ctx.createStereoPanner()
    panner.pan.value = Math.random() * 1.4 - 0.7

    // The dry tick leaves the surface; the surface modes carry the body.
    const air = ctx.createGain()
    air.gain.value = AIR_LEVEL

    source.connect(envelope)
    envelope.connect(band)
    band.connect(panner)
    for (const mode of this.modes) {
      panner.connect(mode)
    }
    panner.connect(air)
    air.connect(this.output)

    this.active += 1
    source.onended = () => {
      this.active -= 1
      source.disconnect()
      envelope.disconnect()
      band.disconnect()
      panner.disconnect()
      air.disconnect()
    }

    const offset = Math.random() * Math.max(0, 0.05 - duration - 0.002)
    source.start(at, offset, duration)
    source.stop(at + duration)
  }

  dispose(): void {
    try {
      this.hiss.stop()
    } catch {
      /* already stopped */
    }
    for (const mode of this.modes) {
      mode.disconnect()
    }
    this.hiss.disconnect()
    this.hissGain.disconnect()
    this.output.disconnect()
  }
}
