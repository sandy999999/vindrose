export const BEATS_PER_BAR = 4
export const BARS_PER_PHRASE = 8

export function barDuration(bpm: number): number {
  return (60 / bpm) * BEATS_PER_BAR
}

export function barIndexAt(time: number, origin: number, bpm: number): number {
  return Math.floor((time - origin) / barDuration(bpm))
}

export function phraseIndexAt(time: number, origin: number, bpm: number): number {
  return Math.floor(barIndexAt(time, origin, bpm) / BARS_PER_PHRASE)
}

const LOOKAHEAD_SECONDS = 0.12
const TICK_MS = 25

export class Scheduler {
  private origin = 0
  private nextBar = 0
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(
    private bpm: number,
    private readonly onBar: (time: number, bar: number) => void,
    private readonly now: () => number,
  ) {}

  start(origin: number = this.now()): void {
    this.stop()
    this.origin = origin
    this.nextBar = 0
    this.tick()
    this.timer = setInterval(() => this.tick(), TICK_MS)
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  tick(): void {
    const horizon = this.now() + LOOKAHEAD_SECONDS
    let time = this.origin + this.nextBar * barDuration(this.bpm)
    while (time <= horizon) {
      this.onBar(time, this.nextBar)
      this.nextBar += 1
      time = this.origin + this.nextBar * barDuration(this.bpm)
    }
  }

  setBpm(bpm: number): void {
    this.bpm = bpm
  }

  get barOrigin(): number {
    return this.origin
  }

  get currentBar(): number {
    return this.nextBar
  }
}
