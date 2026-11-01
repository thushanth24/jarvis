import { execFile, type ChildProcess } from 'node:child_process';
import { access } from 'node:fs/promises';
import path from 'node:path';

export type SpeechResult = 'completed' | 'cancelled';
type Exec = (file: string, args: string[], options: { windowsHide: boolean; env?: NodeJS.ProcessEnv; timeout?: number }, callback: (error: Error | null) => void) => ChildProcess;

const probeScript = "$ErrorActionPreference='Stop';Add-Type -AssemblyName System.Speech;$s=New-Object System.Speech.Synthesis.SpeechSynthesizer;$s.Dispose()";
const speakScript = "$ErrorActionPreference='Stop';Add-Type -AssemblyName System.Speech;$s=New-Object System.Speech.Synthesis.SpeechSynthesizer;try{if($env:JARVIS_TTS_VOICE){$s.SelectVoice($env:JARVIS_TTS_VOICE)};$s.Speak([Environment]::GetEnvironmentVariable('JARVIS_TTS_TEXT'))}finally{$s.Dispose()}";

export function windowsPowerShellPath(environment: NodeJS.ProcessEnv = process.env): string | null {
  const root = environment.SystemRoot ?? environment.WINDIR;
  return root ? path.win32.join(root, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe') : null;
}

type ActiveSpeech = { child: ChildProcess | null; finish: (result: SpeechResult) => void; cancelled: boolean };

export class WindowsSpeechService {
  private active: ActiveSpeech | null = null;
  private availabilityCheck: Promise<boolean> | null = null;

  constructor(
    private readonly execute: Exec = execFile as unknown as Exec,
    private readonly executable: string | null = windowsPowerShellPath(),
    private readonly fileExists: (filePath: string) => Promise<boolean> = async (filePath) => {
      try { await access(filePath); return true; } catch { return false; }
    }
  ) {}

  available(): Promise<boolean> {
    this.availabilityCheck ??= this.probe();
    return this.availabilityCheck;
  }

  private async probe(): Promise<boolean> {
    if (!this.executable || !(await this.fileExists(this.executable))) return false;
    return new Promise((resolve) => {
      try {
        this.execute(this.executable!, ['-NoProfile', '-NonInteractive', '-Command', probeScript], { windowsHide: true, timeout: 10_000 }, (error) => resolve(!error));
      } catch { resolve(false); }
    });
  }

  async speak(text: string, voiceName?: string): Promise<SpeechResult> {
    if (!text.trim() || text.length > 500) throw new Error('Speech text must contain 1 to 500 characters.');
    if (voiceName && voiceName.length > 100) throw new Error('Invalid voice selection.');
    if (!(await this.available()) || !this.executable) throw new Error('Windows System.Speech is unavailable.');
    this.stop();
    return new Promise<SpeechResult>((resolve, reject) => {
      const request: ActiveSpeech = { child: null, finish: resolve, cancelled: false };
      this.active = request;
      try {
        const child = this.execute(this.executable!, ['-NoProfile', '-NonInteractive', '-Command', speakScript], {
          windowsHide: true,
          env: { ...process.env, JARVIS_TTS_TEXT: text, JARVIS_TTS_VOICE: voiceName ?? '' }
        }, (error) => {
          if (this.active === request) this.active = null;
          if (request.cancelled) return;
          if (error) reject(new Error('Windows speech synthesis failed. Check the selected voice and audio output.'));
          else resolve('completed');
        });
        request.child = child;
        if (request.cancelled) child.kill();
      } catch {
        if (this.active === request) this.active = null;
        reject(new Error('Windows speech synthesis could not start.'));
      }
    });
  }

  stop(): boolean {
    const request = this.active;
    if (!request) return false;
    this.active = null;
    request.cancelled = true;
    request.finish('cancelled');
    if (request.child && !request.child.killed) request.child.kill();
    return true;
  }
}
