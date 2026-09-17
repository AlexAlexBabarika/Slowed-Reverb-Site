import type { EffectState } from '../stores/effects';
import { clamp, dbToGain } from './math';
import { REVERB_DECAY, REVERB_SECONDS, buildImpulseResponse } from './reverb';

const FADE_SECONDS = 0.02;

interface Graph {
  lowpass: BiquadFilterNode;
  convolver: ConvolverNode;
  wet: GainNode;
  dry: GainNode;
  master: GainNode;
  output: GainNode;
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
  private atEnd = false;
  private graphUsed = false;
  private impulse: AudioBuffer;
  private retired = new Map<ReturnType<typeof setTimeout>, {
    graph: Graph;
    source: AudioBufferSourceNode | null;
  }>();
  onended: (() => void) | null = null;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
    this.impulse = buildImpulseResponse(ctx, REVERB_SECONDS, REVERB_DECAY);
    this.graph = this.createGraph();
  }

  private createGraph(): Graph {
    const ctx = this.ctx;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    const convolver = ctx.createConvolver();
    convolver.buffer = this.impulse;
    const wet = ctx.createGain();
    wet.gain.value = 0;
    const dry = ctx.createGain();
    const master = ctx.createGain();
    const output = ctx.createGain();
    output.gain.value = 0;

    // lowpass fans out to dry + (convolver → wet); both sum into master → out
    lowpass.connect(dry);
    lowpass.connect(convolver);
    convolver.connect(wet);
    dry.connect(master);
    wet.connect(master);
    master.connect(output);
    output.connect(ctx.destination);

    return { lowpass, convolver, wet, dry, master, output };
  }

  async decode(url: string, signal?: AbortSignal): Promise<AudioBuffer> {
    const res = await fetch(url, { credentials: 'same-origin', signal });
    if (!res.ok) throw new Error(`Could not fetch audio (${res.status}).`);
    const data = await res.arrayBuffer();
    signal?.throwIfAborted();
    const decoded = await this.ctx.decodeAudioData(data);
    signal?.throwIfAborted();
    return decoded;
  }

  async load(url: string, signal?: AbortSignal): Promise<number> {
    const decoded = await this.decode(url, signal);
    this.setBuffer(decoded);
    return decoded.duration;
  }

  setBuffer(buffer: AudioBuffer | null): void {
    this.stop();
    this.buffer = buffer;
  }

  applyEffects(state: EffectState): void {
    if (this.playing && state.speed !== (this.state?.speed ?? 1)) {
      this.offset = this.currentTime;
      this.startedAt = this.ctx.currentTime;
    }
    this.state = state;
    this.graph.lowpass.frequency.value = state.lowpass;
    this.graph.wet.gain.value = state.reverb;
    this.graph.dry.gain.value = 1 - state.reverb;
    this.graph.master.gain.value = dbToGain(state.gainDb);
    if (this.source) this.source.playbackRate.value = state.speed;
  }

  resume(): Promise<void> {
    return this.ctx.resume();
  }

  play(offsetSeconds = this.offset): Promise<void> {
    if (!this.buffer) return Promise.resolve();
    this.retireGraph();
    const from = offsetSeconds >= this.duration ? 0 : clamp(offsetSeconds, 0, this.duration);
    const source = this.ctx.createBufferSource();
    source.buffer = this.buffer;
    if (this.state) source.playbackRate.value = this.state.speed;
    source.connect(this.graph.lowpass);
    source.onended = () => { if (this.source === source) this.endOfBuffer(); };
    this.source = source;
    this.offset = from;
    this.startedAt = this.ctx.currentTime;
    this.playing = true;
    this.atEnd = false;
    this.graphUsed = true;
    this.rampOutput(this.graph, 1);
    source.start(0, from);
    return this.resume().catch((error: unknown) => {
      if (this.source === source) this.pause();
      throw error;
    });
  }

  pause(): void {
    const at = this.currentTime;
    this.playing = false;
    this.offset = at;
    this.retireGraph();
  }

  stop(): void {
    this.pause();
    this.offset = 0;
    this.atEnd = false;
  }

  seek(seconds: number): Promise<void> {
    if (!Number.isFinite(seconds)) return Promise.resolve();
    const target = clamp(seconds, 0, this.duration);
    const wasPlaying = this.playing;
    this.pause();
    this.offset = target;
    this.atEnd = false;
    if (wasPlaying && target < this.duration) {
      return this.play(target);
    }
    return Promise.resolve();
  }

  get duration(): number { return this.buffer?.duration ?? 0; }

  get currentTime(): number {
    if (!this.playing) return this.offset;
    const elapsed = (this.ctx.currentTime - this.startedAt) * (this.state?.speed ?? 1);
    return clamp(this.offset + elapsed, 0, this.duration);
  }

  get isPlaying(): boolean { return this.playing; }

  get ended(): boolean { return this.atEnd; }

  get decoded(): AudioBuffer | null { return this.buffer; }

  dispose(): void {
    this.onended = null;
    for (const [timer, { graph, source }] of this.retired) {
      clearTimeout(timer);
      source?.stop();
      source?.disconnect();
      this.disconnectGraph(graph);
    }
    this.retired.clear();
    if (this.source) {
      this.source.onended = null;
      this.source.stop();
      this.source.disconnect();
      this.source = null;
    }
    this.playing = false;
    this.offset = 0;
    this.atEnd = false;
    this.buffer = null;
    this.disconnectGraph(this.graph);
    void this.ctx.close().catch(() => {});
  }

  private retireGraph(): void {
    if (!this.graphUsed) return;
    const source = this.source;
    const graph = this.graph;
    this.source = null;
    if (source) {
      source.onended = null;
      source.stop(this.ctx.currentTime + FADE_SECONDS);
    }
    this.rampOutput(graph, 0);
    const timer = setTimeout(() => {
      source?.disconnect();
      this.disconnectGraph(graph);
      this.retired.delete(timer);
    }, FADE_SECONDS * 1000);
    this.retired.set(timer, { graph, source });
    this.graph = this.createGraph();
    this.graphUsed = false;
    if (this.state) this.applyEffects(this.state);
  }

  private endOfBuffer(): void {
    this.source?.disconnect();
    this.source = null;
    this.playing = false;
    this.offset = this.duration;
    this.atEnd = true;
    this.onended?.();
  }

  private rampOutput(graph: Graph, value: number): void {
    const gain = graph.output.gain;
    const now = this.ctx.currentTime;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(value, now + FADE_SECONDS);
  }

  private disconnectGraph(graph: Graph): void {
    for (const node of Object.values(graph)) node.disconnect();
  }
}
