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

## Needs Windows verification

- Actual tray icon rendering on the target Windows configuration.
- Shortcut conflict behavior.
- Actual Chrome launch on the target Windows installation.
- Actual tray icon rendering and shortcut conflict behavior.
- Launch behavior for Terminal and Explorer on the target Windows installation.

## Not implemented yet

Voice, local TTS, SQLite memory, Ollama, cloud/subscription providers, paid budget controls, screenshots, file search, browser automation, coding workflows, email/calendar, installer, and first-run wizard.
