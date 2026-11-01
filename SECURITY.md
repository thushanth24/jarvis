# Security

The renderer runs with `contextIsolation`, `sandbox`, and `nodeIntegration: false`. It receives only three validated operations through preload: execute a typed command, toggle the window, and read basic system information.

The initial router only maps known application names and absolute Windows paths. It does not interpret arbitrary shell strings. Folder opening validates an absolute path and delegates only to `explorer.exe`.

Before adding cloud providers, implement explicit external-data permission, secure Windows credential storage, per-task paid approval, append-only budget audit, and prompt-injection isolation for web/document content.
