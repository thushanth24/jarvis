# JARVIS Desktop

Local-first Windows desktop assistant built with Electron, React, and TypeScript. The current implementation is the Phase 1 vertical slice: typed deterministic commands, a tray-resident window, a global toggle shortcut, and safe app/folder launching.

## Run on Windows

1. Install Node.js 20+.
2. In PowerShell, from this folder run `npm.cmd install`.
3. Run `npm.cmd run dev`.

The development window opens after Vite starts. Press `Ctrl + Shift + J` to show or hide it. Closing the window minimizes JARVIS to the tray; choose **Quit** from the tray menu to exit.

Development startup compiles the Electron main process before launching it. If the development diagnostics report an outdated main process, quit the existing JARVIS tray instance and stop the old development terminal before starting `npm.cmd run dev` again.

Run validation with `npm.cmd run typecheck`, `npm.cmd test`, and `npm.cmd run build`.

## Commands in this milestone

`Open VS Code`, `Open Chrome`, `Open Notepad`, `Open Calculator`, `Open File Explorer`, `Open Terminal`, `Open C:\Projects`, `What is the time?`, and `Help`.

VS Code and Chrome must be discoverable on PATH or configured in a future settings screen. The app never executes arbitrary shell text from the chat input.

Chrome is detected from standard Windows install locations and App Paths registry entries. If Chrome is installed elsewhere, configure the full executable path before launching JARVIS, for example in PowerShell: `$env:JARVIS_CHROME_PATH = 'D:\\Apps\\Chrome\\chrome.exe'`.

## Phase 2 offline voice setup

1. Download a Windows `whisper-cli.exe` build from the official [whisper.cpp repository](https://github.com/ggml-org/whisper.cpp). If building from source, the Windows output is produced under `build\\bin\\Release` after the normal CMake build. Keep the executable and its adjacent DLLs together.
2. Download a Whisper model from the official [whisper.cpp model sources](https://huggingface.co/ggerganov/whisper.cpp). Start with `ggml-tiny.en.bin`; use `ggml-base.en.bin` for better accuracy at higher CPU cost. Do not download models automatically from JARVIS.
3. Optional: configure the full paths in the PowerShell session used to start JARVIS. If omitted, JARVIS automatically detects `%LOCALAPPDATA%\\JARVIS\\whisper\\`:

```powershell
$env:JARVIS_WHISPER_CLI = 'C:\Tools\whisper.cpp\whisper-cli.exe'
$env:JARVIS_WHISPER_MODEL = 'C:\Tools\whisper.cpp\models\ggml-tiny.en.bin'
$env:JARVIS_PROJECT_PATH = 'E:\Personal\jarvis'
npm.cmd run dev
```

The browser microphone permission is requested only when the mic button is clicked. Click once to record, click again to stop, or press Escape to cancel. The recording is encoded locally as 16 kHz mono WAV, transcribed by Whisper, and removed from temporary storage after processing. Windows speech synthesis is used for short responses; the Speech on/off control disables it.

### Test speech and microphone cleanup on Windows

Quit any existing JARVIS tray instance, then run `npm.cmd run dev` from this folder. Make sure **Speech on** is selected and click **Test Voice**. You should hear “Hello. I am Jarvis. Your personal assistant is ready.” The development speech diagnostics should show the engine available, followed by `started` and `completed`. If audio fails, the UI displays an error.

Next, click the microphone, say “Jarvis, open VS Code”, and click it again. Confirm the recording indicator stops before transcription, VS Code opens, and JARVIS says “Opening VS Code.” Start a second recording to confirm the microphone can be reacquired. Press Escape during another recording; it should cancel without submitting audio. Hide JARVIS to the tray during a recording and confirm the microphone indicator turns off. Use the tray **Quit** menu to stop the application and any active speech.

Recording uses Web Audio callbacks (`ScriptProcessorNode`), not `MediaRecorder`. Captured PCM chunks are retained until stop; microphone tracks are stopped before Whisper receives the completed WAV. No `MediaRecorder` `dataavailable` event is involved.

## Current limitations

Voice, SQLite memory, Ollama, cloud providers, browser workflows, screenshots, email/calendar, packaging, and the first-run wizard are planned phases, not silently represented as complete. Voice input and the microphone button are intentionally not active in this milestone.

See [ARCHITECTURE.md](ARCHITECTURE.md), [SECURITY.md](SECURITY.md), [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md), and [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md).
