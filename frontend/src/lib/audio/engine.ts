import type { EffectState } from '../stores/effects';
import { dbToGain } from './math';
import { buildImpulseResponse } from './reverb';

interface Graph {
  lowpass: BiquadFilterNode;
  convolver: ConvolverNode;
  wet: GainNode;
  dry: GainNode;
  master: GainNode;
}

export class AudioEngine {
  private ctx: AudioContext;
  private buffer: AudioBuffer | null = null;
  private source: AudioBufferSourceNode | null = null;
  private graph: Graph;
  private state: EffectState | null = null;
  private startedAt = 0;        // ctx.currentTime when current source started
  private offset = 0;           // playback position when paused
  private playing = false;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    const convolver = ctx.createConvolver();
    convolver.buffer = buildImpulseResponse(ctx, 2.5, 3.0);
    const wet = ctx.createGain();
    const dry = ctx.createGain();
    const master = ctx.createGain();

    // lowpass fans out to dry + (convolver → wet); both sum into master → out
    lowpass.connect(dry);
    lowpass.connect(convolver);
    convolver.connect(wet);
    dry.connect(master);
    wet.connect(master);
    master.connect(ctx.destination);

    this.graph = { lowpass, convolver, wet, dry, master };
  }

  async load(url: string): Promise<number> {
    const res = await fetch(url, { credentials: 'same-origin' });
    const data = await res.arrayBuffer();
    this.buffer = await this.ctx.decodeAudioData(data);
    this.offset = 0;
    return this.buffer.duration;
  }

  applyEffects(state: EffectState): void {
    this.state = state;
    this.graph.lowpass.frequency.value = state.lowpass;
    this.graph.wet.gain.value = state.reverb;
    this.graph.dry.gain.value = 1 - state.reverb;
    this.graph.master.gain.value = dbToGain(state.gainDb);
    if (this.source) this.source.playbackRate.value = state.speed;
  }

  play(offsetSeconds = this.offset): void {
    if (!this.buffer) return;
    void this.ctx.resume();
    if (this.source) { try { this.source.stop(); } catch { /* already stopped */ } }
    const source = this.ctx.createBufferSource();
    source.buffer = this.buffer;
    if (this.state) source.playbackRate.value = this.state.speed;
    source.connect(this.graph.lowpass);
    source.start(0, offsetSeconds);
    source.onended = () => { if (this.playing && this.source === source) this.pause(); };
    this.source = source;
    this.offset = offsetSeconds;
    this.startedAt = this.ctx.currentTime;
    this.playing = true;
  }

  pause(): void {
    if (this.source) { try { this.source.stop(); } catch { /* already stopped */ } }
    this.offset = this.currentTime;
    this.source = null;
    this.playing = false;
  }

  seek(seconds: number): void {
    const wasPlaying = this.playing;
    this.pause();
    this.offset = seconds;
    if (wasPlaying) this.play(seconds);
  }

  get duration(): number { return this.buffer?.duration ?? 0; }

  get currentTime(): number {
    if (!this.playing || !this.state) return this.offset;
    return this.offset + (this.ctx.currentTime - this.startedAt) * this.state.speed;
  }

  get isPlaying(): boolean { return this.playing; }

  get decoded(): AudioBuffer | null { return this.buffer; }

  dispose(): void {
    this.pause();
    this.graph.master.disconnect();
  }
}
