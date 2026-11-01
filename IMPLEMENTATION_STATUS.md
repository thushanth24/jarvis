# Implementation status

## Working in this milestone

- Electron + React + TypeScript project structure.
- Dark JARVIS assistant interface.
- Tray residency and Ctrl+Shift+J toggle.
- Typed deterministic routing for app launches, folders, time, and help.
- Allowlisted launches for VS Code, Chrome, Notepad, Calculator, Explorer, and Terminal.
- Chrome discovery through standard Windows installation paths, App Paths registry entries, and `JARVIS_CHROME_PATH` fallback.
- Absolute-path and directory validation for folders, with Electron `shell.openPath` and friendly missing-folder errors.
- Router and Windows-launching unit tests plus build/typecheck scripts.
- Push-to-talk microphone capture with click-to-start, click-to-stop, and Escape cancellation.
- Local 16 kHz mono WAV encoding in the renderer and temporary-file cleanup in the main process.
- Lazy Whisper configuration resolution with user-path, environment-path, and `%LOCALAPPDATA%\\JARVIS\\whisper\\` automatic-detection precedence.
- Development-only sanitized configuration diagnostics and single-instance Electron protection.
- Centralized conservative application aliases and natural command normalization for voice transcripts.
- Development diagnostics showing raw Whisper text, normalized command text, and matched intent.
- Explicit ambiguity handling for uncertain application phrases instead of blind launching.
- Short Whisper initial-prompt vocabulary hints for JARVIS, VS Code, Visual Studio Code, and Chrome.
- Shared WAV encoder verified as 16 kHz mono signed 16-bit PCM.
- Offline Whisper transcription adapter with graceful missing-config and failure messages.
- Windows local speech synthesis through Windows PowerShell 5.1 and `System.Speech`, with explicit assembly load, completion tracking, speech toggle, interruption, and Test Voice button.
- Development speech diagnostics show enabled/available state, requested length, and started/completed/cancelled/failed status without logging speech contents.
- Microphone tracks stop before transcription; capture closes AudioContext, cancels on tray hide/page unload, and cleans up after permission or audio initialization failure.
- Microphone selection, listening/processing/executing/speaking/error indicators, and setup guidance.
- 52 automated tests, including command-to-speech flow, Windows TTS cancellation/failure, and microphone release across repeated sessions and audio graph failures.
- Development startup compiles Electron main and preload code before launch; the renderer warns when connected to an outdated main process.
- Explicit Visual Studio Code aliases support minor punctuation/hyphen variants while `Visual Studio` and `code` remain ambiguous.

## Needs Windows verification

- Final live Windows verification: Test Voice audibility, command speech, and microphone hardware release on submit, Escape cancellation, tray hide, and application quit.

- Actual tray icon rendering on the target Windows configuration.
- Shortcut conflict behavior.
- Actual Chrome launch on the target Windows installation.
- Actual tray icon rendering and shortcut conflict behavior.
- Launch behavior for Terminal and Explorer on the target Windows installation.
- Real speaker and microphone hardware behavior remains unverified in automated tests.

## Not implemented yet

SQLite memory, Ollama, cloud/subscription providers, paid budget controls, screenshots, file search, browser automation, coding workflows, email/calendar, installer, and first-run wizard.
