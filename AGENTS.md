# NanoClaw Development

See [CLAUDE.md](CLAUDE.md) for project overview and key files. See [README.md](README.md) for architecture and usage.

## Cursor Cloud specific instructions

### Services overview

NanoClaw is a single Node.js process (`src/index.ts`) that connects to WhatsApp via Baileys, stores messages in SQLite (embedded via `better-sqlite3`), and routes them to Claude agents running in isolated Docker containers (`nanoclaw-agent:latest`).

### Development commands

All standard commands are in `package.json`:
- `npm run dev` — run with tsx hot reload
- `npm run build` — compile TypeScript
- `npm test` — run vitest
- `npm run typecheck` — type check without emit
- `npm run format:check` / `npm run format:fix` — Prettier

Pre-commit hook (`.husky/pre-commit`) runs `npm run format:fix`.

### Docker requirement

The app calls `docker info` on startup and exits fatally if Docker is not available. Before running `npm run dev`, ensure the Docker daemon is running:

```bash
sudo dockerd &>/tmp/dockerd.log &
```

The agent container image must be built before agents can execute:

```bash
sudo bash container/build.sh
```

### WhatsApp auth

The app requires WhatsApp authentication (QR code pairing) stored in `store/auth/`. Without it, the app starts, connects to WA servers, then logs an error and exits. This is expected in CI/cloud environments without a paired phone. The rest of the system (DB, container runtime, scheduler, IPC) initializes correctly regardless.

### Key gotchas

- The project uses ESM (`"type": "module"` in package.json). Imports must use `.js` extensions.
- `better-sqlite3` is a native C++ addon — `npm install` needs `gcc` and `make` (pre-installed on most systems).
- The container image (`nanoclaw-agent:latest`) is built from `container/Dockerfile` and includes Chromium, `agent-browser`, and `@anthropic-ai/claude-code`. Rebuilding takes ~1-2 minutes.
- In Docker-in-Docker environments (like this cloud VM), Docker needs `fuse-overlayfs` storage driver and `iptables-legacy`. See daemon config at `/etc/docker/daemon.json`.
