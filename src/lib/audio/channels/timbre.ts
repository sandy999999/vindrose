import type { AudioEvent } from '../../domain/events'
import type { InstrumentChannel } from '../engine'
import type { TimbreName } from '../timbres'

export type VoiceFactory = (name: TimbreName) => InstrumentChannel

const FADE_SECONDS = 0.5
const FADE_MS = FADE_SECONDS * 1000

interface Slot {
  name: TimbreName
  channel: InstrumentChannel
  gain: GainNode
}

/**
 * Holds one voice at a time and crossfades to a freshly built voice on a
 * timbre change, so a swap never clicks or gaps.
 */
export class TimbreChannel implements InstrumentChannel {
  readonly output: GainNode

  private current: Slot
  private readonly fading = new Set<Slot>()
  private lastTarget: unknown = null
  private lastTau = 20
  private disposed = false

  constructor(
    private readonly ctx: AudioContext,
    private readonly createVoice: VoiceFactory,
    initial: TimbreName,
  ) {
    this.output = ctx.createGain()
    this.current = this.mount(initial, 1)
  }

  get timbre(): TimbreName {
    return this.current.name
  }

  setTimbre(name: TimbreName): void {
    if (this.disposed || name === this.current.name) return

    const now = this.ctx.currentTime
    const outgoing = this.current
    const incoming = this.mount(name, 0)

    incoming.gain.gain.setValueAtTime(0, now)
    incoming.gain.gain.linearRampToValueAtTime(1, now + FADE_SECONDS)
    outgoing.gain.gain.setValueAtTime(1, now)
    outgoing.gain.gain.linearRampToValueAtTime(0, now + FADE_SECONDS)

    this.current = incoming
    this.fading.add(outgoing)
    setTimeout(() => {
      this.fading.delete(outgoing)
      if (this.disposed) return
      outgoing.channel.dispose()
      outgoing.gain.disconnect()
    }, FADE_MS + 50)
  }

  update(target: unknown, tau: number): void {
    this.lastTarget = target
    this.lastTau = tau
    this.current.channel.update(target, tau)
    for (const slot of this.fading) {
      slot.channel.update(target, tau)
    }
  }

  fire(event: AudioEvent): void {
    this.current.channel.fire?.(event)
  }

  onBar(time: number, bar: number): void {
    this.current.channel.onBar?.(time, bar)
  }

  dispose(): void {
    this.disposed = true
    this.current.channel.dispose()
    this.current.gain.disconnect()
    for (const slot of this.fading) {
      slot.channel.dispose()
      slot.gain.disconnect()
    }
    this.fading.clear()
    this.output.disconnect()
  }

  private mount(name: TimbreName, gainValue: number): Slot {
    const channel = this.createVoice(name)
    const gain = this.ctx.createGain()
    gain.gain.value = gainValue
    channel.output.connect(gain)
    gain.connect(this.output)
    if (this.lastTarget !== null) {
      channel.update(this.lastTarget, this.lastTau)
    }
    return { name, channel, gain }
  }
}
