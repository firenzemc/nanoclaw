# NanoClaw — OpenCode Edition

This is the NanoClaw project, a WhatsApp-connected AI assistant powered by OpenCode.

## Architecture

- **Host process** (`src/`): Node.js app that connects to WhatsApp, manages groups, and spawns containers
- **Container agent** (`container/agent-runner/`): Runs inside Docker/Podman containers, uses OpenCode SDK to execute AI queries
- **IPC**: Host ↔ container communication via JSON files in mounted directories
- **MCP server** (`container/agent-runner/src/ipc-mcp-stdio.ts`): Provides nanoclaw-specific tools (send_message, schedule_task, etc.)

## Key Files

- `src/index.ts` — Main entry point, WhatsApp connection
- `src/container-runner.ts` — Spawns and manages container agents
- `container/agent-runner/src/index.ts` — Container-side agent using OpenCode SDK
- `container/agent-runner/src/ipc-mcp-stdio.ts` — MCP server for IPC tools

## Development

```bash
npm install
npm run build
npm start
```

## Container Build

```bash
cd container && ./build.sh
```
