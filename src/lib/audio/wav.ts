export function toInt16(value: number): number {
  const clamped = Math.max(-1, Math.min(1, value))
  return clamped < 0 ? Math.round(clamped * 0x8000) : Math.round(clamped * 0x7fff)
}

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i += 1) {
    view.setUint8(offset + i, text.charCodeAt(i))
  }
}

export function encodeWav(chunks: Int16Array[], sampleRate: number, channels: number): Blob {
  let samples = 0
  for (const chunk of chunks) {
    samples += chunk.length
  }

  const dataBytes = samples * 2
  const buffer = new ArrayBuffer(44 + dataBytes)
  const view = new DataView(buffer)

  writeAscii(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataBytes, true)
  writeAscii(view, 8, 'WAVE')
  writeAscii(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, channels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * channels * 2, true)
  view.setUint16(32, channels * 2, true)
  view.setUint16(34, 16, true)
  writeAscii(view, 36, 'data')
  view.setUint32(40, dataBytes, true)

  let offset = 44
  for (const chunk of chunks) {
    for (let i = 0; i < chunk.length; i += 1) {
      const sample = chunk[i] ?? 0
      view.setInt16(offset, sample, true)
      offset += 2
    }
  }

  return new Blob([buffer], { type: 'audio/wav' })
}
