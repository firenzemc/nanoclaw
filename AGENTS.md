# NanoClaw

Personal Claude assistant. See [README.md](README.md) for philosophy and setup. See [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) for architecture decisions.

## Quick Context

Single Node.js process that connects to WhatsApp, routes messages to Claude Agent SDK running in containers (Linux VMs). Each group has isolated filesystem and memory.

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Orchestrator: state, message loop, agent invocation |
| `src/channels/whatsapp.ts` | WhatsApp connection, auth, send/receive |
| `src/ipc.ts` | IPC watcher and task processing |
| `src/router.ts` | Message formatting and outbound routing |
| `src/config.ts` | Trigger pattern, paths, intervals |
| `src/container-runner.ts` | Spawns agent containers with mounts |
| `src/task-scheduler.ts` | Runs scheduled tasks |
| `src/db.ts` | SQLite operations |
| `groups/{name}/CLAUDE.md` | Per-group memory (isolated) |
| `container/skills/agent-browser.md` | Browser automation tool (available to all agents via Bash) |

## Skills

| Skill | When to Use |
|-------|-------------|
| `/setup` | First-time installation, authentication, service configuration |
| `/customize` | Adding channels, integrations, changing behavior |
| `/debug` | Container issues, logs, troubleshooting |
| `/update` | Pull upstream NanoClaw changes, merge with customizations, run migrations |
| `/qodo-pr-resolver` | Fetch and fix Qodo PR review issues interactively or in batch |
| `/get-qodo-rules` | Load org- and repo-level coding rules from Qodo before code tasks |

## Development

Run commands directly—don't tell the user to run them.

```bash
npm run dev # Run with hot reload
npm run build # Compile TypeScript
./container/build.sh # Rebuild agent container
```

Service management:
```bash
# macOS (launchd)
launchctl load ~/Library/LaunchAgents/com.nanoclaw.plist
launchctl unload ~/Library/LaunchAgents/com.nanoclaw.plist
launchctl kickstart -k gui/$(id -u)/com.nanoclaw # restart

# Linux (systemd)
systemctl --user start nanoclaw
systemctl --user stop nanoclaw
systemctl --user restart nanoclaw
```

## Container Build Cache

The container buildkit caches the build context aggressively. `--no-cache` alone does NOT invalidate COPY steps — the builder's volume retains stale files. To force a truly clean rebuild, prune the builder then re-run `./container/build.sh`.

## Cursor Cloud specific instructions

### Services overview

NanoClaw is a single Node.js process (`npm run dev`) that requires:
- **Docker** — must be running; the app checks `docker info` on startup and fatally exits if unavailable
- **WhatsApp auth** — one-time QR scan via `npm run auth`; auth state persisted in `store/`
- **Anthropic API key** — `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` in `.env` (needed for agent container execution, not for the host process itself)

SQLite is embedded via `better-sqlite3` — no separate database process.

### Development commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start with hot-reload (tsx) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run typecheck` | Type-check without emitting |
| `npm run format:check` | Check Prettier formatting |
| `npm run format:fix` | Auto-fix formatting |
| `npm test` | Run vitest (352 tests) |
| `./container/build.sh` | Build `nanoclaw-agent:latest` Docker image |

### Docker in Cloud Agent VM

Docker requires special setup in the Cloud Agent environment (Docker-in-Docker inside Firecracker):
1. Install `fuse-overlayfs` and configure `/etc/docker/daemon.json` with `{"storage-driver": "fuse-overlayfs"}`
2. Switch iptables to legacy mode: `update-alternatives --set iptables /usr/sbin/iptables-legacy`
3. Start dockerd manually: `sudo dockerd &`
4. Fix socket permissions: `sudo chmod 666 /var/run/docker.sock`

### Gotchas

- The pre-commit hook runs `npm run format:fix` (Prettier auto-format). Husky is configured in `.husky/pre-commit`.
- The app connects to WhatsApp servers immediately on startup; without auth state in `store/`, it logs an error and exits. This is expected behavior — WhatsApp auth requires scanning a QR code from a phone.
- Tests run fully without Docker or WhatsApp — all external dependencies are mocked in vitest.
- The container image build (`container/build.sh`) takes ~70s and installs Chromium, `agent-browser`, and `@anthropic-ai/claude-code` globally.
