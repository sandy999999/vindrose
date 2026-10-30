import type { AudioEvent } from '../../domain/events'
import type { InstrumentChannel } from '../engine'
import { createNoiseBuffer } from '../noise'

interface ThunderTarget {
  level: number
}

const RUMBLE_MIN = 2
const RUMBLE_MAX = 6
const RUMBLE_TOP = 180
const RUMBLE_FLOOR = 60
const CRACK_MIN_HZ = 1000
const CRACK_STEP_HZ = 2000
const CRACK_SECONDS = 0.04

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
    this.peak = 0.4 + 0.6 * event.strength
    this.output.gain.setTargetAtTime(this.level * this.peak, this.ctx.currentTime, 0.05)
    this.rumble(event.strength)
    this.crack(event.strength)
  }

  private rumble(strength: number): void {
    const ctx = this.ctx
    const now = ctx.currentTime
    const duration = RUMBLE_MIN + (RUMBLE_MAX - RUMBLE_MIN) * strength

    const source = ctx.createBufferSource()
    source.buffer = this.noise

    const lowpass = ctx.createBiquadFilter()
    lowpass.type = 'lowpass'
    lowpass.Q.value = 0.9
    lowpass.frequency.setValueAtTime(RUMBLE_TOP, now)
    lowpass.frequency.exponentialRampToValueAtTime(RUMBLE_FLOOR, now + duration)

    const envelope = ctx.createGain()
    envelope.gain.setValueAtTime(0.0001, now)
    envelope.gain.linearRampToValueAtTime(strength, now + 0.25)
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration)

    source.connect(lowpass)
    lowpass.connect(envelope)
    envelope.connect(this.output)

    this.track(source, () => {
      lowpass.disconnect()
      envelope.disconnect()
    })
    source.start(now)
    source.stop(now + duration)
  }

  private crack(strength: number): void {
    const ctx = this.ctx
    const at = ctx.currentTime + 0.02

    const source = ctx.createBufferSource()
    source.buffer = this.noise

    const highpass = ctx.createBiquadFilter()
    highpass.type = 'highpass'
    highpass.frequency.value = CRACK_MIN_HZ + CRACK_STEP_HZ * strength

    const envelope = ctx.createGain()
    envelope.gain.setValueAtTime(0.0001, at)
    envelope.gain.linearRampToValueAtTime(strength * 0.8, at + 0.002)
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + CRACK_SECONDS)

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
