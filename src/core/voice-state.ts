export type VoiceState = 'idle' | 'listening' | 'processing' | 'executing' | 'speaking' | 'error';
export type VoiceEvent = 'start' | 'stop' | 'transcription-complete' | 'execution-complete' | 'speech-complete' | 'cancel' | 'failure';

export function transitionVoiceState(state: VoiceState, event: VoiceEvent): VoiceState {
  if (event === 'failure') return 'error';
  if (event === 'cancel') return state === 'listening' || state === 'processing' ? 'idle' : state;
  if (state === 'idle' && event === 'start') return 'listening';
  if (state === 'listening' && event === 'stop') return 'processing';
  if (state === 'processing' && event === 'transcription-complete') return 'executing';
  if (state === 'executing' && event === 'execution-complete') return 'speaking';
  if (state === 'speaking' && event === 'speech-complete') return 'idle';
  if (state === 'error' && event === 'start') return 'listening';
  return state;
}

export function microphoneErrorMessage(): string {
  return 'Microphone access is unavailable. Check Windows microphone permissions and try again.';
}
