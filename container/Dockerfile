# NanoClaw Agent Container — OpenCode Edition
# Runs OpenCode AI coding agent in isolated Linux container with browser automation
#
# Key differences from the Claude-based version:
#   - Installs `opencode-ai` CLI instead of `@anthropic-ai/claude-code`
#   - Uses `@opencode-ai/sdk` instead of `@anthropic-ai/claude-agent-sdk`
#   - Provider-agnostic: works with OpenAI, Gemini, Anthropic, Groq, local models
#   - OpenCode server runs inside container, agent-runner communicates via SDK

FROM node:22-slim

# Install system dependencies for Chromium and general tooling
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    fonts-noto-color-emoji \
    libgbm1 \
    libnss3 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libasound2 \
    libpangocairo-1.0-0 \
    libcups2 \
    libdrm2 \
    libxshmfence1 \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Set Chromium path for agent-browser
ENV AGENT_BROWSER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium

# Install agent-browser and opencode globally
# opencode-ai is the CLI; the SDK is installed as a project dependency
RUN npm install -g agent-browser opencode-ai@latest

# Create app directory
WORKDIR /app

# Copy package files first for better caching
COPY agent-runner/package*.json ./

# Install dependencies (includes @opencode-ai/sdk)
RUN npm install

# Copy source code
COPY agent-runner/ ./

# Build TypeScript
RUN npm run build

# Create workspace directories
RUN mkdir -p /workspace/group /workspace/global /workspace/extra \
    /workspace/ipc/messages /workspace/ipc/tasks /workspace/ipc/input

# Create entrypoint script
# Secrets are passed via stdin JSON — temp file is deleted immediately after Node reads it
# Follow-up messages arrive via IPC files in /workspace/ipc/input/
RUN printf '#!/bin/bash\nset -e\ncd /app && npx tsc --outDir /tmp/dist 2>&1 >&2\nln -s /app/node_modules /tmp/dist/node_modules\nchmod -R a-w /tmp/dist\ncat > /tmp/input.json\nnode /tmp/dist/index.js < /tmp/input.json\n' > /app/entrypoint.sh && chmod +x /app/entrypoint.sh

# Create OpenCode data directory (sessions, config, etc.)
RUN mkdir -p /home/node/.local/share/opencode

# Set ownership to node user (non-root) for writable directories
RUN chown -R node:node /workspace /home/node

# Switch to non-root user
USER node

# Set working directory to group workspace
WORKDIR /workspace/group

# Entry point reads JSON from stdin, outputs JSON to stdout
ENTRYPOINT ["/app/entrypoint.sh"]
