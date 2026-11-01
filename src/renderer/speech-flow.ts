import type { CommandResult } from '../shared/types';

export type SpeechStatus = 'started' | 'completed' | 'cancelled' | 'failed' | 'disabled' | 'skipped';

export async function speakReply(
  text: string,
  enabled: boolean,
  speak: (text: string) => Promise<'completed' | 'cancelled'>,
  report: (status: SpeechStatus) => void
): Promise<void> {
  if (!enabled) { report('disabled'); return; }
  if (!text.trim() || text.length > 300) { report('skipped'); return; }
  report('started');
  try { report(await speak(text)); }
  catch (error) { report('failed'); throw error; }
}

export async function executeVoiceCommand(
  command: string,
  execute: (text: string) => Promise<CommandResult>,
  onResult: (result: CommandResult) => void,
  reply: (text: string) => Promise<void>
): Promise<CommandResult> {
  const result = await execute(command);
  onResult(result);
  await reply(result.message);
  return result;
}
