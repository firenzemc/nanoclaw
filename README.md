<p align="center">
  <img src="assets/nanoclaw-logo.png" alt="NanoClaw" width="400">
</p>

<p align="center">
  An AI assistant that runs agents securely in their own containers. Lightweight, built to be easily understood and completely customized for your needs.
</p>

<p align="center">
  <b>OpenCode Edition</b> — Provider-agnostic fork powered by <a href="https://opencode.ai">OpenCode</a> instead of Claude Code
</p>

## What Changed (OpenCode Edition)

This is a fork of [NanoClaw](https://github.com/qwibitai/nanoclaw) that replaces the Anthropic Claude Code dependency with [OpenCode](https://github.com/anomalyco/opencode) — a provider-agnostic AI coding agent.

**Key differences from upstream:**

| Aspect | Original NanoClaw | OpenCode Edition |
|--------|------------------|------------------|
| AI Engine | Claude Code (Anthropic-only) | OpenCode (any provider) |
| SDK | `@anthropic-ai/claude-agent-sdk` | `@opencode-ai/sdk` |
| API Keys | `ANTHROPIC_API_KEY` only | OpenAI, Gemini, Groq, Anthropic, OpenRouter, xAI, local models |
| Container CLI | `@anthropic-ai/claude-code` | `opencode-ai` |
| Context Files | `CLAUDE.md` only | `OPENCODE.md` (with `CLAUDE.md` fallback) |
| Session Storage | `~/.claude/` | `~/.local/share/opencode/` |

**Everything else is preserved:** container isolation, IPC mechanism, MCP tools, WhatsApp integration, scheduled tasks, group management, skills system, and the overall architecture.

## Quick Start

```bash
git clone <this-repo>
cd nanoclaw-opencode

# Configure your preferred AI provider
cp .env.example .env
# Edit .env and set at least one API key (e.g., OPENAI_API_KEY)

npm install
npm run build

# Build the container image
cd container && ./build.sh && cd ..

npm start
```

## Supported AI Providers

OpenCode supports multiple AI providers. Set the corresponding API key in your `.env` file:

| Provider | Environment Variable | Example Models |
|----------|---------------------|----------------|
| OpenAI | `OPENAI_API_KEY` | gpt-4.1, gpt-4o, o3 |
| Google Gemini | `GEMINI_API_KEY` | gemini-2.5-pro, gemini-2.5-flash |
| Anthropic | `ANTHROPIC_API_KEY` | claude-sonnet-4, claude-haiku-3.5 |
| Groq | `GROQ_API_KEY` | llama-4-maverick, qwen-qwq |
| OpenRouter | `OPENROUTER_API_KEY` | Any model on OpenRouter |
| xAI | `XAI_API_KEY` | grok-3 |
| Local | (none needed) | Ollama, LM Studio, etc. |

Configure your preferred model in `opencode.json` at the project root or per-group level.

## Why This Fork

The original NanoClaw is an excellent project with a clean architecture and strong security model. However, it is tightly coupled to Anthropic's Claude Code ecosystem. This fork decouples the AI engine, allowing you to:

1. **Choose your provider** — Use OpenAI, Gemini, Groq, or any other supported model
2. **Reduce costs** — Switch to cheaper models for simple tasks
3. **Stay flexible** — Not locked into a single vendor's ecosystem
4. **Use local models** — Run fully offline with Ollama or LM Studio

## Philosophy

Inherited from the original NanoClaw:

**Small enough to understand.** One process, a few source files and no microservices.

**Secure by isolation.** Agents run in Linux containers and they can only see what's explicitly mounted.

**Built for the individual user.** NanoClaw is designed to be bespoke — make your own fork and modify it to match your needs.

**Customization = code changes.** No configuration sprawl. Want different behavior? Modify the code.

Added in this fork:

**Provider-agnostic.** Your AI assistant shouldn't lock you into a single vendor. Switch models with a config change, not a rewrite.

## What It Supports

- **Messenger I/O** - Message NanoClaw from your phone. Supports WhatsApp, Telegram, Discord, Slack, Signal and headless operation.
- **Isolated group context** - Each group has its own `OPENCODE.md` (or `CLAUDE.md`) memory, isolated filesystem, and runs in its own container sandbox.
- **Main channel** - Your private channel for admin control; every group is completely isolated
- **Scheduled tasks** - Recurring jobs that run the AI agent and can message you back
- **Web access** - Search and fetch content from the Web
- **Container isolation** - Agents are sandboxed in Docker (macOS/Linux) or Apple Container (macOS)
- **MCP tools** - Full MCP (Model Context Protocol) support for extensible tool use
- **Optional integrations** - Add Gmail and more via skills

## Usage

Talk to your assistant with the trigger word (default: `@Andy`):

```
@Andy send an overview of the sales pipeline every weekday morning at 9am
@Andy review the git history for the past week each Friday and update the README if there's drift
@Andy every Monday at 8am, compile news on AI developments and message me a briefing
```

From the main channel (your self-chat), you can manage groups and tasks:
```
@Andy list all scheduled tasks across groups
@Andy pause the Monday briefing task
@Andy join the Family Chat group
```

## Architecture

```
WhatsApp (baileys) --> SQLite --> Polling loop --> Container (OpenCode SDK) --> Response
```

Single Node.js process. Agents execute in isolated Linux containers with filesystem isolation. Only mounted directories are accessible. Per-group message queue with concurrency control. IPC via filesystem.

Key files:
- `src/index.ts` - Orchestrator: state, message loop, agent invocation
- `src/channels/whatsapp.ts` - WhatsApp connection, auth, send/receive
- `src/ipc.ts` - IPC watcher and task processing
- `src/router.ts` - Message formatting and outbound routing
- `src/group-queue.ts` - Per-group queue with global concurrency limit
- `src/container-runner.ts` - Spawns streaming agent containers
- `src/task-scheduler.ts` - Runs scheduled tasks
- `src/db.ts` - SQLite operations (messages, groups, sessions, state)
- `container/agent-runner/src/index.ts` - Container-side agent using OpenCode SDK
- `container/agent-runner/src/ipc-mcp-stdio.ts` - MCP server for IPC tools
- `groups/*/OPENCODE.md` - Per-group memory (also reads `CLAUDE.md` for compatibility)

## Requirements

- macOS or Linux
- Node.js 20+
- [Docker](https://docker.com/products/docker-desktop) (macOS/Linux) or [Apple Container](https://github.com/apple/container) (macOS)
- At least one AI provider API key

## FAQ

**Why OpenCode instead of Claude Code?**

OpenCode is provider-agnostic, open-source, and supports the same core capabilities (bash, file editing, web access, MCP). It lets you choose your AI provider instead of being locked into Anthropic.

**Can I still use Claude/Anthropic?**

Yes! OpenCode supports Anthropic as one of many providers. Set `ANTHROPIC_API_KEY` in your `.env` and configure the model in `opencode.json`.

**Is this compatible with the original NanoClaw?**

The IPC protocol, MCP tools, container isolation, and overall architecture are identical. Context files (`CLAUDE.md`) are still supported for backwards compatibility. The main difference is the AI engine inside the container.

**How do I switch models?**

Edit the `opencode.json` configuration file at the project root or per-group level. OpenCode supports model configuration per provider.

## Contributing

Follow the same philosophy as the original NanoClaw: contribute skills, not features.

## License

MIT
