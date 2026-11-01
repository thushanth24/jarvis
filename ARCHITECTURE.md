# Architecture

The app is a modular monolith with four boundaries:

- `src/main`: privileged Electron process, tray, global shortcut, IPC handlers, and allowlisted Windows launches.
- `src/preload`: narrow context-isolated API exposed to the renderer.
- `src/renderer`: React interface only; it has no Node.js or shell access.
- `src/core` and `src/shared`: deterministic routing and shared contracts, testable without Electron.

Future providers, memory, permissions, tasks, and budget enforcement should be added behind interfaces in `src/core`, with all external effects kept in main-process modules.
