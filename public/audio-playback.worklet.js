// audio-playback.worklet.js
export default class PCM24kPlayback extends AudioWorkletProcessor {
  constructor() {
    super();
    this.queue = [];
    this.cur = null;
    this.readOffset = 0;
    this.playRatio = sampleRate / 24000; // device rate / input rate
    this.phase = 0; // fractional read position
    this.port.onmessage = (e) => {
      if (e.data?.type === 'append') {
        this.queue.push(new Uint8Array(e.data.buffer));
      }
    };
  }

  // Read next sample from the 24kHz queue, return Float32
  readNextSample() {
    if (!this.cur || this.readOffset >= this.cur.length) {
      this.cur = this.queue.shift();
      this.readOffset = 0;
      if (!this.cur) return 0;
    }
    const lo = this.cur[this.readOffset++] ?? 0;
    const hi = this.cur[this.readOffset++] ?? 0;
    const s16 = (hi << 8) | lo;
    return (s16 >= 0x8000 ? s16 - 0x10000 : s16) / 32768;
  }

  process(_inputs, outputs) {
    const out = outputs[0][0];
    let prevSample = 0;
    let nextSample = this.readNextSample();

    for (let i = 0; i < out.length; i++) {
      // Linear interpolation between prevSample and nextSample
      out[i] = prevSample + (nextSample - prevSample) * this.phase;

      this.phase += 1 / this.playRatio;

      // When phase reaches/exceeds 1.0, move to the next sample
      while (this.phase >= 1.0) {
        prevSample = nextSample;
        nextSample = this.readNextSample();
        this.phase -= 1.0;
      }
    }
    return true;
  }
}

registerProcessor('pcm24k-playback', PCM24kPlayback);
