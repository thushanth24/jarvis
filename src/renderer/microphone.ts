export interface CapturedAudio { chunks: Float32Array[]; sampleRate: number }
type AudioGraph = {
  stream: MediaStream;
  context: AudioContext;
  source: MediaStreamAudioSourceNode;
  processor: ScriptProcessorNode;
  mute: GainNode;
  chunks: Float32Array[];
};

function disconnectSafely(node: { disconnect(): void } | null): void {
  try { node?.disconnect(); } catch { /* continue releasing the remaining audio resources */ }
}

function stopTracks(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => {
    try { track.stop(); } catch { /* continue stopping the remaining tracks */ }
  });
}

/** The capture implementation uses Web Audio callbacks; it does not use MediaRecorder. */
export class MicrophoneCapture {
  private graph: AudioGraph | null = null;
  private generation = 0;

  constructor(
    private readonly getStream: (constraints: MediaStreamConstraints) => Promise<MediaStream> = (constraints) => navigator.mediaDevices.getUserMedia(constraints),
    private readonly createContext: () => AudioContext = () => new AudioContext({ sampleRate: 16000 })
  ) {}

  get active(): boolean { return this.graph !== null; }

  async start(deviceId = ''): Promise<void> {
    if (this.graph) throw new Error('Microphone is already recording.');
    const generation = ++this.generation;
    let stream: MediaStream | null = null;
    let context: AudioContext | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let processor: ScriptProcessorNode | null = null;
    let mute: GainNode | null = null;
    try {
      stream = await this.getStream({ audio: deviceId ? { deviceId: { exact: deviceId } } : true });
      if (generation !== this.generation) { stopTracks(stream); return; }
      context = this.createContext();
      await context.resume();
      if (generation !== this.generation) { stopTracks(stream); await context.close().catch(() => undefined); return; }
      source = context.createMediaStreamSource(stream);
      processor = context.createScriptProcessor(4096, 1, 1);
      mute = context.createGain(); mute.gain.value = 0;
      const chunks: Float32Array[] = [];
      processor.onaudioprocess = (event) => chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)));
      source.connect(processor); processor.connect(mute); mute.connect(context.destination);
      this.graph = { stream, context, source, processor, mute, chunks };
    } catch (error) {
      disconnectSafely(processor); disconnectSafely(source); disconnectSafely(mute);
      stopTracks(stream);
      if (context) await context.close().catch(() => undefined);
      throw error;
    }
  }

  async stop(): Promise<CapturedAudio | null> {
    const graph = this.release();
    if (!graph) return null;
    // Web Audio callbacks have already filled the chunks; there is no MediaRecorder dataavailable event.
    const audio = { chunks: graph.chunks, sampleRate: graph.context.sampleRate };
    await graph.context.close().catch(() => undefined);
    return audio;
  }

  cancel(): void {
    this.generation += 1;
    const graph = this.release();
    if (graph) void graph.context.close().catch(() => undefined);
  }

  private release(): AudioGraph | null {
    const graph = this.graph;
    this.graph = null;
    if (!graph) return null;
    graph.processor.onaudioprocess = null;
    disconnectSafely(graph.processor); disconnectSafely(graph.source); disconnectSafely(graph.mute);
    stopTracks(graph.stream);
    return graph;
  }
}
