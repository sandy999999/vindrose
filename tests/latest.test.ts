import { describe, it, expect } from 'vitest'
import { latestOnly } from '../src/lib/weather/latest'

describe('latestOnly', () => {
  it('drops a response that finishes after a newer request', async () => {
    const latest = latestOnly<number>()
    let resolveFirst: (value: number) => void = () => undefined
    let resolveSecond: (value: number) => void = () => undefined

    const first = latest(
      () =>
        new Promise<number>((resolve) => {
          resolveFirst = resolve
        }),
    )
    const second = latest(
      () =>
        new Promise<number>((resolve) => {
          resolveSecond = resolve
        }),
    )

    resolveSecond(2)
    resolveFirst(1)

    await expect(first).resolves.toBeNull()
    await expect(second).resolves.toBe(2)
  })

  it('keeps a single call that is still the newest', async () => {
    const latest = latestOnly<string>()
    await expect(latest(async () => 'only')).resolves.toBe('only')
  })
})
