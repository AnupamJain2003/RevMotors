// Captures 48k float stereo from mic, converts to 16k PCM16 mono in 20ms chunks.
class PCM16kCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this._resampleRatio = 16000 / sampleRate; // sampleRate is AudioWorklet global
    this._buffer = [];
    this._acc = 0;
    this._frameSamples = Math.round(0.02 * 16000); // 20ms @16k = 320 samples
  }
  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;
    const chL = input[0];
    for (let i = 0; i < chL.length; i++) {
      // Downmix L/R if needed (we only read channel 0 here)
      // Resample by simple accumulator (good enough for voice)
      this._acc += this._resampleRatio;
      while (this._acc >= 1) {
        const s = Math.max(-1, Math.min(1, chL[i]));
        const int16 = Math.round(s * 32767);
        this._buffer.push(int16 & 0xff, (int16 >> 8) & 0xff);
        this._acc -= 1;
      }
      if (this._buffer.length >= this._frameSamples * 2) {
        const buf = new Uint8Array(this._buffer.splice(0, this._frameSamples * 2)).buffer;
        this.port.postMessage({ type: 'chunk', buffer: buf }, [buf]);
      }
    }
    return true;
  }
}
registerProcessor('pcm16k-capture', PCM16kCapture);