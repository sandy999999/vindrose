import type { AudioEvent } from '../../domain/events'
import { clamp } from '../../domain/units'
import type { InstrumentChannel } from '../engine'
import { createNoiseBuffer } from '../noise'

interface ThunderTarget {
  level: number
}

const RUMBLE_MIN = 3
const RUMBLE_MAX = 6
const RUMBLE_TOP = 180
const RUMBLE_FLOOR = 50
const SHADOW_TOP = 140
const SHADOW_FLOOR = 90
const CRACK_MIN_HZ = 1000
const CRACK_STEP_HZ = 2000
const CRACK_SECONDS = 0.045
const REFLECTIONS: ReadonlyArray<{ delay: number; gain: number }> = [
  { delay: 0.19, gain: 0.55 },
  { delay: 0.47, gain: 0.3 },
]

export class ThunderChannel implements InstrumentChannel {
  readonly output: GainNode

  private readonly noise: AudioBuffer
  private readonly live = new Set<AudioBufferSourceNode>()
  private level = 0
  private peak = 1

  constructor(private readonly ctx: AudioContext) {
    this.output = ctx.createGain()
    this.output.gain.value = 0
    this.noise = createNoiseBuffer(ctx, 6)
  }

  update(target: unknown, tau: number): void {
    this.level = (target as ThunderTarget).level
    this.output.gain.setTargetAtTime(this.level * this.peak, this.ctx.currentTime, tau)
  }

  fire(event: AudioEvent): void {
    if (event.type !== 'thunder-crack') return
    const strength = clamp(event.strength, 0, 1)
    this.peak = 0.4 + 0.6 * strength
    this.output.gain.setTargetAtTime(this.level * this.peak, this.ctx.currentTime, 0.05)
    this.rumble(strength)
    this.crack(strength)
  }

  private rumble(strength: number): void {
    const ctx = this.ctx
    const now = ctx.currentTime
    const distance = 1 - strength
    const duration = RUMBLE_MIN + (RUMBLE_MAX - RUMBLE_MIN) * strength
    const nodes: AudioNode[] = []

    const source = ctx.createBufferSource()
    source.buffer = this.noise

    // Distance rolls the highs off the direct path.
    const lowpass = ctx.createBiquadFilter()
    lowpass.type = 'lowpass'
    lowpass.Q.value = 0.9
    lowpass.frequency.setValueAtTime(RUMBLE_TOP - 60 * distance, now)
    lowpass.frequency.exponentialRampToValueAtTime(
      RUMBLE_FLOOR * (1 - 0.5 * distance),
      now + duration,
    )

    const envelope = ctx.createGain()
    envelope.gain.setValueAtTime(0.0001, now)
    envelope.gain.linearRampToValueAtTime(strength, now + 0.2)
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration)

    source.connect(lowpass)
    lowpass.connect(envelope)
    envelope.connect(this.output)
    nodes.push(lowpass, envelope)

    // Ground reflections arrive later, darker and quieter: the roll of thunder.
    for (const reflection of REFLECTIONS) {
      const delay = ctx.createDelay(2)
      delay.delayTime.value = reflection.delay + Math.random() * 0.2
      const shade = ctx.createBiquadFilter()
      shade.type = 'lowpass'
      shade.frequency.value = SHADOW_TOP - (SHADOW_TOP - SHADOW_FLOOR) * distance
      shade.Q.value = 0.7
      const gain = ctx.createGain()
      gain.gain.value = reflection.gain * (1 - 0.35 * distance)
      source.connect(delay)
      delay.connect(shade)
      shade.connect(gain)
      gain.connect(this.output)
      nodes.push(delay, shade, gain)
    }

    this.track(source, () => {
      for (const node of nodes) node.disconnect()
    })
    source.start(now)
    source.stop(now + duration)
  }

  private crack(strength: number): void {
    const ctx = this.ctx
    const at = ctx.currentTime + 0.02
    const distance = 1 - strength

    const source = ctx.createBufferSource()
    source.buffer = this.noise

    const highpass = ctx.createBiquadFilter()
    highpass.type = 'highpass'
    highpass.frequency.value = (CRACK_MIN_HZ + CRACK_STEP_HZ * strength) * (1 - 0.5 * distance)

    const envelope = ctx.createGain()
    envelope.gain.setValueAtTime(0.0001, at)
    envelope.gain.linearRampToValueAtTime(strength * 0.8, at + 0.002)
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + CRACK_SECONDS * (0.6 + 0.4 * strength))

    source.connect(highpass)
    highpass.connect(envelope)
    envelope.connect(this.output)

    this.track(source, () => {
      highpass.disconnect()
      envelope.disconnect()
    })
    source.start(at, Math.random() * 2, CRACK_SECONDS)
    source.stop(at + CRACK_SECONDS)
  }

  private track(source: AudioBufferSourceNode, cleanup: () => void): void {
    this.live.add(source)
    source.onended = () => {
      this.live.delete(source)
      source.disconnect()
      cleanup()
    }
  }

  dispose(): void {
    for (const source of this.live) {
      try {
        source.stop()
      } catch {
        /* already stopped */
      }
      source.disconnect()
    }
    this.live.clear()
    this.output.disconnect()
  }
}
