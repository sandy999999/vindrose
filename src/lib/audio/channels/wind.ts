import type { AudioEvent } from '../../domain/events'
import type { InstrumentChannel } from '../engine'
import { createNoiseBuffer } from '../noise'

interface WindTarget {
  level: number
  freq: number
  q: number
  pan: number
  breath: number
}

const HARMONIC_RATIO = 2.7
const BED_LOW = 300
const BED_SPAN = 600
const BAND_LEVEL = 1
const HARMONIC_LEVEL = 0.5
const BED_LEVEL = 0.3

export class WindChannel implements InstrumentChannel {
  readonly output: GainNode

  private readonly band: BiquadFilterNode
  private readonly harmonic: BiquadFilterNode
  private readonly bed: BiquadFilterNode
  private readonly bandGain: GainNode
  private readonly harmonicGain: GainNode
  private readonly bedGain: GainNode
  private readonly panner: StereoPannerNode
  private readonly source: AudioBufferSourceNode
  private readonly sweepNoise: AudioBuffer
  private freq = 500
  private q = 8

  constructor(private readonly ctx: AudioContext) {
    this.output = ctx.createGain()
    this.output.gain.value = 0

    this.band = ctx.createBiquadFilter()
    this.band.type = 'bandpass'
    this.band.frequency.value = this.freq
    this.band.Q.value = this.q

    this.harmonic = ctx.createBiquadFilter()
    this.harmonic.type = 'bandpass'
    this.harmonic.frequency.value = this.freq * HARMONIC_RATIO
    this.harmonic.Q.value = this.q

    this.bed = ctx.createBiquadFilter()
    this.bed.type = 'lowpass'
    this.bed.frequency.value = BED_LOW + BED_SPAN
    this.bed.Q.value = 0.7

    this.bandGain = ctx.createGain()
    this.bandGain.gain.value = BAND_LEVEL
    this.harmonicGain = ctx.createGain()
    this.harmonicGain.gain.value = HARMONIC_LEVEL
    this.bedGain = ctx.createGain()
    this.bedGain.gain.value = BED_LEVEL

    this.panner = ctx.createStereoPanner()

    this.source = ctx.createBufferSource()
    this.source.buffer = createNoiseBuffer(ctx, 4)
    this.source.loop = true

    this.sweepNoise = createNoiseBuffer(ctx, 1.5)

    this.source.connect(this.band)
    this.source.connect(this.harmonic)
    this.source.connect(this.bed)
    this.band.connect(this.bandGain)
    this.harmonic.connect(this.harmonicGain)
    this.bed.connect(this.bedGain)
    this.bandGain.connect(this.panner)
    this.harmonicGain.connect(this.panner)
    // Breath is the diffuse roar of the air itself: low frequency, bending
    // around the head, so it stays centred while the resonances take the pan.
    this.bedGain.connect(this.output)
    this.panner.connect(this.output)
    this.source.start()
  }

  update(target: unknown, tau: number): void {
    const wind = target as WindTarget
    const now = this.ctx.currentTime
    this.freq = wind.freq
    this.q = wind.q
    this.output.gain.setTargetAtTime(wind.level, now, tau)
    this.band.frequency.setTargetAtTime(wind.freq, now, tau)
    this.band.Q.setTargetAtTime(wind.q, now, tau)
    this.harmonic.frequency.setTargetAtTime(wind.freq * HARMONIC_RATIO, now, tau)
    this.harmonic.Q.setTargetAtTime(wind.q, now, tau)
    this.bed.frequency.setTargetAtTime(BED_LOW + BED_SPAN * wind.breath, now, tau)
    this.panner.pan.setTargetAtTime(wind.pan, now, tau)
  }

  fire(event: AudioEvent): void {
    if (event.type !== 'direction-sweep') return
    const ctx = this.ctx
    const now = ctx.currentTime

    const source = ctx.createBufferSource()
    source.buffer = this.sweepNoise

    const band = ctx.createBiquadFilter()
    band.type = 'bandpass'
    band.Q.value = Math.max(2, this.q)
    band.frequency.value = this.freq * 1.5

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.linearRampToValueAtTime(0.12, now + 0.3)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.4)

    const panner = ctx.createStereoPanner()
    panner.pan.setValueAtTime(-event.pan, now)
    panner.pan.linearRampToValueAtTime(event.pan, now + 1.1)

    source.connect(band)
    band.connect(gain)
    gain.connect(panner)
    panner.connect(this.output)

    source.onended = () => {
      source.disconnect()
      band.disconnect()
      gain.disconnect()
      panner.disconnect()
    }

    source.start(now)
    source.stop(now + 1.5)
  }

  dispose(): void {
    try {
      this.source.stop()
    } catch {
      /* already stopped */
    }
    this.source.disconnect()
    this.band.disconnect()
    this.harmonic.disconnect()
    this.bed.disconnect()
    this.bandGain.disconnect()
    this.harmonicGain.disconnect()
    this.bedGain.disconnect()
    this.panner.disconnect()
    this.output.disconnect()
  }
}
