import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { encodePcm16Wav } from '../core/audio';
import { COMMAND_PROTOCOL_VERSION } from '../shared/types';
import { MicrophoneCapture } from './microphone';
import { executeVoiceCommand, speakReply, type SpeechStatus } from './speech-flow';
import './styles.css';

type Message = { role: 'user' | 'assistant'; text: string; time: string; source?: 'typed' | 'voice' };
type VoiceState = 'idle' | 'listening' | 'processing' | 'executing' | 'speaking' | 'error';
type Diagnostic = { raw: string; normalized: string; intent: string; app?: string };
type SpeechDiagnostic = { requestedLength: number; status: SpeechStatus | 'idle'; error?: string };
const TEST_VOICE_TEXT = 'Hello. I am Jarvis. Your personal assistant is ready.';

const initial: Message[] = [{ role: 'assistant', text: 'Good to see you. I’m ready for local commands.', time: 'NOW' }];
const now = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function App() {
  const [messages, setMessages] = useState<Message[]>(initial);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [voiceEnabled, setVoiceEnabled] = useState(() => localStorage.getItem('jarvis.speechEnabled') !== 'false');
  const [speechAvailable, setSpeechAvailable] = useState(false);
  const [speechDiagnostic, setSpeechDiagnostic] = useState<SpeechDiagnostic>({ requestedLength: 0, status: 'idle' });
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState('');
  const [voiceReady, setVoiceReady] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const [diagnostic, setDiagnostic] = useState<Diagnostic | null>(null);
  const [mainOutdated, setMainOutdated] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const microphoneRef = useRef(new MicrophoneCapture());
  const voiceStateRef = useRef(voiceState);
  voiceStateRef.current = voiceState;
  const diagnosticsEnabled = import.meta.env.DEV;

  useEffect(() => {
    inputRef.current?.focus();
    void window.jarvis.getSystemInfo().then((info) => setMainOutdated(info.commandProtocol !== COMMAND_PROTOCOL_VERSION)).catch(() => setMainOutdated(true));
    void window.jarvis.getVoiceAvailability().then((availability) => { setVoiceReady(Boolean(availability.whisperExecutable && availability.whisperModel)); setSpeechAvailable(availability.speechAvailable); }).catch(() => setSpeechAvailable(false));
  }, []);
  useEffect(() => { localStorage.setItem('jarvis.speechEnabled', String(voiceEnabled)); }, [voiceEnabled]);
  useEffect(() => {
    const cancel = (event: KeyboardEvent) => { if (event.key === 'Escape' && voiceStateRef.current === 'listening') cancelRecording(); };
    const cancelOnHide = () => cancelRecording();
    const onPageHide = () => microphoneRef.current.cancel();
    const unsubscribe = typeof window.jarvis.onRecordingCancel === 'function'
      ? window.jarvis.onRecordingCancel(cancelOnHide)
      : () => undefined;
    if (typeof window.jarvis.onRecordingCancel !== 'function') setMainOutdated(true);
    window.addEventListener('keydown', cancel);
    window.addEventListener('pagehide', onPageHide);
    return () => { unsubscribe(); window.removeEventListener('keydown', cancel); window.removeEventListener('pagehide', onPageHide); microphoneRef.current.cancel(); };
  }, []);

  function addMessage(role: Message['role'], text: string, source: Message['source'] = 'typed') {
    setMessages((current) => [...current, { role, text, source, time: now() }]);
  }

  async function runCommand(command: string, speakResult: boolean, rawText = command) {
    setBusy(true);
    const onResult = (result: Awaited<ReturnType<typeof window.jarvis.executeCommand>>) => {
      if (typeof result.intent?.normalizedText !== 'string') setMainOutdated(true);
      setDiagnostic({ raw: rawText, normalized: result.intent.normalizedText, intent: result.intent.kind, app: result.intent.app });
      addMessage('assistant', result.message);
      setBusy(false);
    };
    if (speakResult) await executeVoiceCommand(command, window.jarvis.executeCommand, onResult, speakText);
    else onResult(await window.jarvis.executeCommand(command));
  }

  async function speakText(text: string) {
    const report = (status: SpeechStatus) => {
      setSpeechDiagnostic({ requestedLength: text.length, status });
      if (status === 'started') setVoiceState('speaking');
      else setVoiceState('idle');
    };
    try {
      await speakReply(text, voiceEnabled, window.jarvis.speak, report);
    } catch {
      const error = 'Windows speech could not play. Check the selected voice and audio output.';
      setSpeechDiagnostic({ requestedLength: text.length, status: 'failed', error });
      setVoiceError(error);
    }
  }

  async function testVoice() {
    if (!voiceEnabled) { setVoiceError('Turn Speech on before testing the voice.'); return; }
    setVoiceError('');
    await speakText(TEST_VOICE_TEXT);
  }

  async function submit(event?: React.FormEvent) {
    event?.preventDefault();
    const command = input.trim();
    if (!command || busy || voiceState !== 'idle') return;
    setInput(''); addMessage('user', command); await runCommand(command, false, command); inputRef.current?.focus();
  }

  async function refreshDevices() {
    const all = await navigator.mediaDevices.enumerateDevices();
    setDevices(all.filter((device) => device.kind === 'audioinput'));
  }

  async function startRecording() {
    setVoiceError('');
    try {
      await microphoneRef.current.start(deviceId);
      if (!microphoneRef.current.active) return;
      setVoiceState('listening');
      void refreshDevices().catch(() => undefined);
    } catch { microphoneRef.current.cancel(); setVoiceError('Microphone access is unavailable. Check Windows microphone permissions and try again.'); setVoiceState('error'); }
  }

  function cancelRecording() {
    microphoneRef.current.cancel();
    if (voiceStateRef.current === 'listening') setVoiceState('idle');
  }

  async function stopRecording() {
    const audio = await microphoneRef.current.stop();
    if (!audio) return;
    setVoiceState('processing');
    try { const wav = encodePcm16Wav(audio.chunks, audio.sampleRate); const transcription = await window.jarvis.transcribeWav(wav); addMessage('user', transcription.text, 'voice'); setVoiceState('executing'); await runCommand(transcription.text, true, transcription.text); }
    catch (error) { setVoiceError(error instanceof Error ? error.message : 'Voice processing failed.'); setVoiceState('error'); }
  }

  async function toggleRecording() { if (voiceState === 'listening') await stopRecording(); else if (voiceState === 'idle' || voiceState === 'error') await startRecording(); }
  const statusLabel = voiceState === 'listening' ? 'LISTENING' : voiceState === 'processing' ? 'PROCESSING' : voiceState === 'executing' ? 'EXECUTING' : voiceState === 'speaking' ? 'SPEAKING' : voiceState === 'error' ? 'VOICE ERROR' : 'READY';

  return <main className="shell">
    <aside className="rail"><div className="brand"><span className="brand-mark">J</span><span>JARVIS</span></div><nav><button className="active">◉ <span>Assistant</span></button><button>☷ <span>Tasks</span></button><button>◇ <span>Memory</span></button><button>⚙ <span>Settings</span></button></nav><div className="rail-footer"><span className="status-dot" /> Local mode active<br /><small>{voiceReady ? 'Whisper voice ready' : 'Voice setup required'}</small></div></aside>
    <section className="content"><header><div><p className="eyebrow">PERSONAL COMMAND CENTER</p><h1>How can I help?</h1></div><div className="header-status"><span className={`pulse ${voiceState !== 'idle' ? 'active-pulse' : ''}`} /> {statusLabel} <button className="icon-button" title="Minimize to tray" onClick={() => window.jarvis.toggleWindow()}>—</button></div></header>
      <div className="conversation">{messages.map((message, index) => <div className={`message ${message.role}`} key={`${message.time}-${index}`}><div className="avatar">{message.role === 'assistant' ? 'J' : 'YOU'}</div><div><div className="message-meta">{message.role === 'assistant' ? 'JARVIS' : message.source === 'voice' ? 'WHISPER' : 'YOU'} <span>{message.time}</span></div><p>{message.text}</p></div></div>)}{(busy || voiceState === 'processing' || voiceState === 'executing') && <div className="message assistant"><div className="avatar">J</div><div><div className="message-meta">JARVIS</div><p className="typing">{voiceState === 'processing' ? 'Transcribing' : voiceState === 'executing' ? 'Executing' : 'Working'}<span>.</span><span>.</span><span>.</span></p></div></div>}</div>
      {diagnosticsEnabled && mainOutdated && <div className="voice-error" role="alert">The JARVIS main process is outdated. Quit JARVIS from its tray menu, stop the old development terminal, then run npm.cmd run dev again.</div>}
      {diagnosticsEnabled && diagnostic && <details className="diagnostics" open><summary>Development voice diagnostics</summary><div><span>Raw Whisper text</span><code>{diagnostic.raw || '<empty>'}</code></div><div><span>Normalized command</span><code>{diagnostic.normalized || '<empty>'}</code></div><div><span>Matched intent</span><code>{diagnostic.intent}{diagnostic.app ? ` → ${diagnostic.app}` : ''}</code></div></details>}
      {diagnosticsEnabled && <details className="diagnostics"><summary>Speech diagnostics</summary><div><span>Speech enabled</span><code>{String(voiceEnabled)}</code></div><div><span>Engine available</span><code>{String(speechAvailable)}</code></div><div><span>Requested length</span><code>{speechDiagnostic.requestedLength} characters</code></div><div><span>Speech state</span><code>{speechDiagnostic.status}</code></div>{speechDiagnostic.error && <div><span>Failure</span><code>{speechDiagnostic.error}</code></div>}</details>}
      {voiceError && <div className="voice-error">{voiceError} <button onClick={() => setVoiceError('')}>Dismiss</button></div>}
      <div className="voice-controls"><label>Microphone<select value={deviceId} onChange={(event) => setDeviceId(event.target.value)} onFocus={() => void refreshDevices()}><option value="">System default</option>{devices.map((device) => <option value={device.deviceId} key={device.deviceId}>{device.label || 'Microphone'}</option>)}</select></label><button className={`voice-toggle ${voiceEnabled ? 'enabled' : ''}`} onClick={() => setVoiceEnabled((enabled) => !enabled)}>{voiceEnabled ? 'Speech on' : 'Speech off'}</button><button className="voice-toggle" disabled={voiceState === 'speaking'} onClick={() => void testVoice()}>Test Voice</button>{voiceState === 'speaking' && <button className="stop-speaking" onClick={() => { void window.jarvis.stopSpeaking(); }}>Stop speaking</button>}</div>
      <form className="composer" onSubmit={submit}><button type="button" className={`mic ${voiceState === 'listening' ? 'recording' : ''}`} title={voiceState === 'listening' ? 'Stop recording' : 'Start push-to-talk recording'} onClick={() => void toggleRecording()}>{voiceState === 'listening' ? '■' : '⌁'}</button><input ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} placeholder={voiceState === 'listening' ? 'Listening… press the mic again to stop' : 'Ask JARVIS anything…'} disabled={busy || voiceState !== 'idle'} /><button className="send" type="submit">SEND <span>↵</span></button></form><p className="hint">Click the mic to record, click again to stop, or press Escape to cancel · Ctrl + Shift + J toggles the window</p>{!voiceReady && <p className="setup-hint">Offline voice needs Whisper.cpp. Configure <code>JARVIS_WHISPER_CLI</code> and <code>JARVIS_WHISPER_MODEL</code>, then restart JARVIS.</p>}
    </section>
  </main>;
}

createRoot(document.getElementById('root')!).render(<App />);
