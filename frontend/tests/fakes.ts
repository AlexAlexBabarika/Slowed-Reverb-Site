// Minimal Web Audio fakes for unit tests (jsdom has no AudioContext).
export class FakeAudioBuffer {
  length: number;
  sampleRate: number;
  numberOfChannels: number;
  private data: Float32Array[];
  constructor(channels: number, length: number, sampleRate: number) {
    this.length = length;
    this.sampleRate = sampleRate;
    this.numberOfChannels = channels;
    this.data = Array.from({ length: channels }, () => new Float32Array(length));
  }
  get duration(): number { return this.length / this.sampleRate; }
  getChannelData(ch: number): Float32Array { return this.data[ch]; }
}

export class FakeParam {
  value: number;
  constructor(v: number) { this.value = v; }
  setValueAtTime(v: number) { this.value = v; }
  linearRampToValueAtTime(v: number) { this.value = v; }
}

export class FakeNode {
  type = '';
  frequency = new FakeParam(350);
  gain = new FakeParam(1);
  playbackRate = new FakeParam(1);
  buffer: unknown = null;
  connections: FakeNode[] = [];
  ctx: FakeAudioContext;
  constructor(ctx: FakeAudioContext) { this.ctx = ctx; }
  connect(target: FakeNode) { this.connections.push(target); return target; }
  disconnect() { this.connections = []; }
  start() {}
  stop() {}
}

export class FakeAudioContext {
  sampleRate = 44100;
  currentTime = 0;
  destination = new FakeNode(this);
  created: FakeNode[] = [];
  createBuffer(channels: number, length: number, sampleRate: number) {
    return new FakeAudioBuffer(channels, length, sampleRate);
  }
  private make() { const n = new FakeNode(this); this.created.push(n); return n; }
  createBufferSource() { return this.make(); }
  createBiquadFilter() { const n = this.make(); n.type = 'lowpass'; return n; }
  createConvolver() { return this.make(); }
  createGain() { return this.make(); }
  decodeAudioData() { return Promise.resolve(new FakeAudioBuffer(2, this.sampleRate, this.sampleRate)); }
  resume() { return Promise.resolve(); }
  close() { return Promise.resolve(); }
}
