import { describe, it, expect } from 'vitest'
import {
  MAX_RECORD_SECONDS,
  WARN_RECORD_SECONDS,
  Recorder,
  recordAlert,
} from '../src/lib/audio/recorder'

const SAMPLE_RATE = 8000

function makeRecorder() {
  const ctx = { currentTime: 0, sampleRate: SAMPLE_RATE }
  const port: {
    onmessage: ((event: { data: { left: Float32Array; right: Float32Array } }) => void) | null
  } = { onmessage: null }
  const node = { port }
  const recorder = new Recorder(
    ctx as unknown as AudioContext,
    node as unknown as AudioWorkletNode,
  )
  const push = (frames: number): void => {
    port.onmessage?.({
      data: { left: new Float32Array(frames), right: new Float32Array(frames) },
    })
  }
  return { recorder, push }
}

function recordSeconds(recorder: Recorder, push: (frames: number) => void, seconds: number): void {
  recorder.start()
  for (let i = 0; i < seconds; i += 1) push(SAMPLE_RATE)
}

describe('Recorder', () => {
  it('reports the captured length after the cap stops the take', () => {
    const { recorder, push } = makeRecorder()
    recordSeconds(recorder, push, MAX_RECORD_SECONDS)

    expect(recorder.isRecording).toBe(false)
    expect(recorder.elapsed).toBeCloseTo(MAX_RECORD_SECONDS)
  })

  it('writes the whole capped take on stop', () => {
    const { recorder, push } = makeRecorder()
    recordSeconds(recorder, push, MAX_RECORD_SECONDS)

    expect(recorder.stop().durationSec).toBeCloseTo(MAX_RECORD_SECONDS)
  })
})

describe('recordAlert', () => {
  it('warns once at the eight minute mark', () => {
    expect(recordAlert(WARN_RECORD_SECONDS - 1, false)).toBeNull()
    expect(recordAlert(WARN_RECORD_SECONDS, false)).toBe('warn')
    expect(recordAlert(WARN_RECORD_SECONDS + 1, true)).toBeNull()
  })

  it('reports the limit at ten minutes even after the warning', () => {
    expect(recordAlert(MAX_RECORD_SECONDS, true)).toBe('limit')
    expect(recordAlert(MAX_RECORD_SECONDS + 5, false)).toBe('limit')
  })
})
