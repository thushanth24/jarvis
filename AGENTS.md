# JARVIS development rules

- Preserve local-first behavior and never add a paid provider call without explicit per-task approval.
- Keep privileged operations in the Electron main process; keep the renderer sandboxed and expose narrow preload methods.
- Never execute arbitrary shell text or model-generated commands.
- Do not claim unconfigured integrations work.
- Run `npm.cmd run typecheck`, `npm.cmd test`, and `npm.cmd run build` after meaningful changes.
- Update `IMPLEMENTATION_STATUS.md` whenever a milestone changes.
