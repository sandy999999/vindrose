const BLOCK_FRAMES = 4096

class PCMCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.frames = 0
    this.left = new Float32Array(BLOCK_FRAMES)
    this.right = new Float32Array(BLOCK_FRAMES)
  }

  process(inputs) {
    const input = inputs[0]
    if (!input || input.length === 0) return true

    const left = input[0]
    const right = input.length > 1 ? input[1] : left
    if (!left || !right) return true

    for (let i = 0; i < left.length; i += 1) {
      this.left[this.frames] = left[i]
      this.right[this.frames] = right[i]
      this.frames += 1

      if (this.frames === BLOCK_FRAMES) {
        this.flush()
      }
    }

    return true
  }

  flush() {
    if (this.frames === 0) return
    const left = this.left.slice(0, this.frames)
    const right = this.right.slice(0, this.frames)
    this.port.postMessage({ left, right }, [left.buffer, right.buffer])
    this.frames = 0
  }
}

registerProcessor('pcm-capture', PCMCaptureProcessor)
