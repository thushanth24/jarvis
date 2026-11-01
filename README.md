# JARVIS Desktop

Local-first Windows desktop assistant built with Electron, React, and TypeScript. The current implementation is the Phase 1 vertical slice: typed deterministic commands, a tray-resident window, a global toggle shortcut, and safe app/folder launching.

## Run on Windows

1. Install Node.js 20+.
2. In PowerShell, from this folder run `npm.cmd install`.
3. Run `npm.cmd run dev`.

The development window opens after Vite starts. Press `Ctrl + Shift + J` to show or hide it. Closing the window minimizes JARVIS to the tray; choose **Quit** from the tray menu to exit.

Run validation with `npm.cmd run typecheck`, `npm.cmd test`, and `npm.cmd run build`.

## Commands in this milestone

`Open VS Code`, `Open Chrome`, `Open Notepad`, `Open Calculator`, `Open File Explorer`, `Open Terminal`, `Open C:\Projects`, `What is the time?`, and `Help`.

VS Code and Chrome must be discoverable on PATH or configured in a future settings screen. The app never executes arbitrary shell text from the chat input.

Chrome is detected from standard Windows install locations and App Paths registry entries. If Chrome is installed elsewhere, configure the full executable path before launching JARVIS, for example in PowerShell: `$env:JARVIS_CHROME_PATH = 'D:\\Apps\\Chrome\\chrome.exe'`.

## Current limitations

Voice, SQLite memory, Ollama, cloud providers, browser workflows, screenshots, email/calendar, packaging, and the first-run wizard are planned phases, not silently represented as complete. Voice input and the microphone button are intentionally not active in this milestone.

See [ARCHITECTURE.md](ARCHITECTURE.md), [SECURITY.md](SECURITY.md), [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md), and [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md).
