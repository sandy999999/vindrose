import { describe, it, expect } from 'vitest'
import { encodeWav, toInt16 } from '../src/lib/audio/wav'

function ascii(view: DataView, offset: number, length: number): string {
  let text = ''
  for (let i = 0; i < length; i += 1) {
    text += String.fromCharCode(view.getUint8(offset + i))
  }
  return text
}

describe('toInt16', () => {
  it('clamps above and below full scale', () => {
    expect(toInt16(1.5)).toBe(32767)
    expect(toInt16(-1.5)).toBe(-32768)
  })

  it('scales mid values', () => {
    expect(toInt16(0)).toBe(0)
    expect(toInt16(1)).toBe(32767)
    expect(toInt16(-1)).toBe(-32768)
  })
})

describe('encodeWav', () => {
  it('writes a stereo 16 bit header', async () => {
    const blob = encodeWav([new Int16Array([0, 32767, -32768])], 44100, 2)
    expect(blob.type).toBe('audio/wav')
    expect(blob.size).toBe(44 + 6)

    const view = new DataView(await blob.arrayBuffer())
    expect(ascii(view, 0, 4)).toBe('RIFF')
    expect(ascii(view, 8, 4)).toBe('WAVE')
    expect(ascii(view, 12, 4)).toBe('fmt ')
    expect(ascii(view, 36, 4)).toBe('data')
    expect(view.getUint16(22, true)).toBe(2)
    expect(view.getUint32(24, true)).toBe(44100)
    expect(view.getUint16(34, true)).toBe(16)
    expect(view.getUint32(40, true)).toBe(6)
    expect(view.getUint32(4, true)).toBe(blob.size - 8)
  })

  it('concatenates chunks in order', async () => {
    const blob = encodeWav(
      [Int16Array.from([2, -2]), Int16Array.from([4, -4])],
      44100,
      2,
    )
    expect(blob.size).toBe(44 + 8)
    const view = new DataView(await blob.arrayBuffer())
    expect(view.getInt16(44, true)).toBe(2)
    expect(view.getInt16(46, true)).toBe(-2)
    expect(view.getInt16(48, true)).toBe(4)
    expect(view.getInt16(50, true)).toBe(-4)
  })
})
