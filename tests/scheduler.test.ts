import { describe, it, expect } from 'vitest'
import { Scheduler, barDuration, barIndexAt, phraseIndexAt } from '../src/lib/audio/scheduler'

describe('bar maths', () => {
  it('derives the bar length from the tempo', () => {
    expect(barDuration(56)).toBeCloseTo(4.2857, 3)
  })

  it('counts bars from the origin', () => {
    expect(barIndexAt(0, 0, 56)).toBe(0)
    expect(barIndexAt(4.29, 0, 56)).toBe(1)
    expect(barIndexAt(8.5, 0, 56)).toBe(1)
  })

  it('counts eight bar phrases', () => {
    expect(phraseIndexAt(34.3, 0, 56)).toBe(1)
    expect(phraseIndexAt(0, 0, 56)).toBe(0)
  })
})

describe('Scheduler', () => {
  it('fires the current bar once and then each following bar', () => {
    let now = 0
    const calls: Array<{ time: number; bar: number }> = []
    const scheduler = new Scheduler(
      56,
      (time, bar) => calls.push({ time, bar }),
      () => now,
    )

    scheduler.start(0)
    expect(calls).toHaveLength(1)
    expect(calls[0]?.bar).toBe(0)

    now = 4.3
    scheduler.tick()
    expect(calls.map((call) => call.bar)).toEqual([0, 1])

    scheduler.stop()
  })

  it('does not fire a bar before the lookahead reaches it', () => {
    let now = 0
    const bars: number[] = []
    const scheduler = new Scheduler(56, (_time, bar) => bars.push(bar), () => now)

    scheduler.start(0)
    now = 4
    scheduler.tick()
    expect(bars).toEqual([0])

    scheduler.stop()
  })
})
