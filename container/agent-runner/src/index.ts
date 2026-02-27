/**
 * NanoClaw Agent Runner — OpenCode Edition
 * Runs inside a container, receives config via stdin, outputs result to stdout.
 *
 * Instead of the Anthropic Claude Agent SDK, this version uses the OpenCode SDK
 * (@opencode-ai/sdk) to drive an AI coding agent. OpenCode is provider-agnostic
 * and supports OpenAI, Gemini, Anthropic, Groq, local models, and more.
 *
 * Input protocol:
 *   Stdin: Full ContainerInput JSON (read until EOF)
 *   IPC:   Follow-up messages written as JSON files to /workspace/ipc/input/
 *          Files: {type:"message", text:"..."}.json — polled and consumed
 *          Sentinel: /workspace/ipc/input/_close — signals session end
 *
 * Stdout protocol:
 *   Each result is wrapped in OUTPUT_START_MARKER / OUTPUT_END_MARKER pairs.
 *   Multiple results may be emitted (one per turn).
 *   Final marker after loop ends signals completion.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createOpencode, createOpencodeClient } from '@opencode-ai/sdk';

// ── Interfaces ──────────────────────────────────────────────────────────────

interface ContainerInput {
  prompt: string;
  sessionId?: string;
  groupFolder: string;
  chatJid: string;
  isMain: boolean;
  isScheduledTask?: boolean;
  assistantName?: string;
  secrets?: Record<string, string>;
}

interface ContainerOutput {
  status: 'success' | 'error';
  result: string | null;
  newSessionId?: string;
  error?: string;
}

// ── Constants ───────────────────────────────────────────────────────────────

const IPC_INPUT_DIR = '/workspace/ipc/input';
const IPC_INPUT_CLOSE_SENTINEL = path.join(IPC_INPUT_DIR, '_close');
const IPC_POLL_MS = 500;
const OPENCODE_PORT = 14096;

const OUTPUT_START_MARKER = '---NANOCLAW_OUTPUT_START---';
const OUTPUT_END_MARKER = '---NANOCLAW_OUTPUT_END---';

// ── Helpers ─────────────────────────────────────────────────────────────────

async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

function writeOutput(output: ContainerOutput): void {
  console.log(OUTPUT_START_MARKER);
  console.log(JSON.stringify(output));
  console.log(OUTPUT_END_MARKER);
}

function log(message: string): void {
  console.error(`[agent-runner] ${message}`);
}

function shouldClose(): boolean {
  if (fs.existsSync(IPC_INPUT_CLOSE_SENTINEL)) {
    try { fs.unlinkSync(IPC_INPUT_CLOSE_SENTINEL); } catch { /* ignore */ }
    return true;
  }
  return false;
}

function drainIpcInput(): string[] {
  try {
    fs.mkdirSync(IPC_INPUT_DIR, { recursive: true });
    const files = fs.readdirSync(IPC_INPUT_DIR)
      .filter(f => f.endsWith('.json'))
      .sort();

    const messages: string[] = [];
    for (const file of files) {
      const filePath = path.join(IPC_INPUT_DIR, file);
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        fs.unlinkSync(filePath);
        if (data.type === 'message' && data.text) {
          messages.push(data.text);
        }
      } catch (err) {
        log(`Failed to process input file ${file}: ${err instanceof Error ? err.message : String(err)}`);
        try { fs.unlinkSync(filePath); } catch { /* ignore */ }
      }
    }
    return messages;
  } catch (err) {
    log(`IPC drain error: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }
}

function waitForIpcMessage(): Promise<string | null> {
  return new Promise((resolve) => {
    const poll = () => {
      if (shouldClose()) {
        resolve(null);
        return;
      }
      const messages = drainIpcInput();
      if (messages.length > 0) {
        resolve(messages.join('\n'));
        return;
      }
      setTimeout(poll, IPC_POLL_MS);
    };
    poll();
  });
}

// ── Conversation archiving ──────────────────────────────────────────────────

function sanitizeFilename(summary: string): string {
  return summary
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

function generateFallbackName(): string {
  const time = new Date();
  return `conversation-${time.getHours().toString().padStart(2, '0')}${time.getMinutes().toString().padStart(2, '0')}`;
}

/**
 * Archive a conversation session to the group's conversations/ directory.
 * This replaces the Claude PreCompact hook — we call it explicitly when
 * the session ends or when a new session is about to start.
 */
async function archiveSession(
  client: ReturnType<typeof createOpencodeClient>,
  sessionId: string,
  assistantName?: string,
): Promise<void> {
  try {
    const messagesResult = await client.session.messages({ path: { id: sessionId } });
    const messagesData = messagesResult as unknown as Array<{
      info: { role: string };
      parts: Array<{ type: string; text?: string }>;
    }>;

    if (!messagesData || messagesData.length === 0) {
      log('No messages to archive');
      return;
    }

    const conversationsDir = '/workspace/group/conversations';
    fs.mkdirSync(conversationsDir, { recursive: true });

    const date = new Date().toISOString().split('T')[0];
    const name = generateFallbackName();
    const filename = `${date}-${name}.md`;
    const filePath = path.join(conversationsDir, filename);

    const lines: string[] = [];
    lines.push(`# Conversation`);
    lines.push('');
    lines.push(`Archived: ${new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}`);
    lines.push('');
    lines.push('---');
    lines.push('');

    for (const msg of messagesData) {
      const role = msg.info.role;
      const textParts = msg.parts
        .filter(p => p.type === 'text' && p.text)
        .map(p => p.text!);
      const text = textParts.join('\n');
      if (!text) continue;

      const sender = role === 'user' ? 'User' : (assistantName || 'Assistant');
      const content = text.length > 2000 ? text.slice(0, 2000) + '...' : text;
      lines.push(`**${sender}**: ${content}`);
      lines.push('');
    }

    fs.writeFileSync(filePath, lines.join('\n'));
    log(`Archived conversation to ${filePath}`);
  } catch (err) {
    log(`Failed to archive session: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ── OpenCode configuration ──────────────────────────────────────────────────

/**
 * Build the OpenCode configuration for the container.
 * Configures the nanoclaw MCP server, permissions, and model settings.
 */
function buildOpencodeConfig(containerInput: ContainerInput, mcpServerPath: string): Record<string, unknown> {
  return {
    // Allow all tools without prompting (equivalent to Claude's bypassPermissions)
    permission: 'allow',
    // Configure the nanoclaw MCP server for IPC communication
    mcp: {
      nanoclaw: {
        type: 'local',
        command: ['node', mcpServerPath],
        enabled: true,
        environment: {
          NANOCLAW_CHAT_JID: containerInput.chatJid,
          NANOCLAW_GROUP_FOLDER: containerInput.groupFolder,
          NANOCLAW_IS_MAIN: containerInput.isMain ? '1' : '0',
        },
      },
    },
  };
}

/**
 * Build system context from mounted context files.
 * Supports both OPENCODE.md (preferred) and CLAUDE.md (backwards compat).
 */
function buildSystemContext(containerInput: ContainerInput): string {
  const parts: string[] = [];

  // Load global context (shared across all groups, non-main only)
  if (!containerInput.isMain) {
    for (const filename of ['OPENCODE.md', 'CLAUDE.md']) {
      const p = `/workspace/global/${filename}`;
      if (fs.existsSync(p)) {
        parts.push(fs.readFileSync(p, 'utf-8'));
        break;
      }
    }
  }

  // Load project-level context
  for (const filename of ['OPENCODE.md', 'CLAUDE.md']) {
    const p = `/workspace/group/${filename}`;
    if (fs.existsSync(p)) {
      parts.push(fs.readFileSync(p, 'utf-8'));
      break;
    }
  }

  // Load extra directory contexts
  const extraBase = '/workspace/extra';
  if (fs.existsSync(extraBase)) {
    for (const entry of fs.readdirSync(extraBase)) {
      const fullPath = path.join(extraBase, entry);
      if (!fs.statSync(fullPath).isDirectory()) continue;
      for (const mdFile of ['OPENCODE.md', 'CLAUDE.md']) {
        const mdPath = path.join(fullPath, mdFile);
        if (fs.existsSync(mdPath)) {
          parts.push(fs.readFileSync(mdPath, 'utf-8'));
          break;
        }
      }
    }
  }

  return parts.join('\n\n---\n\n');
}

// ── Query execution ─────────────────────────────────────────────────────────

/**
 * Extract text result from OpenCode message parts.
 */
function extractTextFromParts(parts: Array<{ type: string; text?: string }>): string | null {
  const textParts = parts
    .filter(p => p.type === 'text' && p.text)
    .map(p => p.text!);
  return textParts.length > 0 ? textParts.join('\n') : null;
}

/**
 * Run a single query using the OpenCode SDK.
 * Creates or continues a session, sends the prompt, and emits results.
 */
async function runQuery(
  client: ReturnType<typeof createOpencodeClient>,
  prompt: string,
  sessionId: string | undefined,
  containerInput: ContainerInput,
): Promise<{ newSessionId?: string; closedDuringQuery: boolean }> {
  let closedDuringQuery = false;
  let currentSessionId = sessionId;

  // Create or reuse session
  if (!currentSessionId) {
    try {
      const sessionResult = await client.session.create({
        body: { title: `nanoclaw-${containerInput.groupFolder}` },
      });
      // The SDK returns the session data; extract the id
      const session = sessionResult as unknown as { id: string };
      currentSessionId = session.id;
      log(`Created new session: ${currentSessionId}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      log(`Failed to create session: ${errorMessage}`);
      writeOutput({ status: 'error', result: null, error: `Failed to create session: ${errorMessage}` });
      return { closedDuringQuery: false };
    }
  }

  // Inject system context as a no-reply message (context only, no AI response)
  const systemContext = buildSystemContext(containerInput);
  if (systemContext) {
    try {
      await client.session.prompt({
        path: { id: currentSessionId! },
        body: {
          noReply: true,
          parts: [{ type: 'text', text: systemContext }],
        },
      });
      log('Injected system context into session');
    } catch (err) {
      log(`Warning: Failed to inject system context: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Start IPC polling for follow-up messages during the query
  let ipcPolling = true;
  const ipcQueue: string[] = [];

  const pollIpc = () => {
    if (!ipcPolling) return;
    if (shouldClose()) {
      log('Close sentinel detected during query, stopping');
      closedDuringQuery = true;
      ipcPolling = false;
      return;
    }
    const messages = drainIpcInput();
    ipcQueue.push(...messages);
    if (ipcPolling) setTimeout(pollIpc, IPC_POLL_MS);
  };
  setTimeout(pollIpc, IPC_POLL_MS);

  // Send the main prompt and wait for response
  try {
    log(`Sending prompt to session ${currentSessionId} (${prompt.length} chars)`);

    const result = await client.session.prompt({
      path: { id: currentSessionId! },
      body: {
        parts: [{ type: 'text', text: prompt }],
      },
    });

    // Extract the text result from the response
    const resultData = result as unknown as {
      info: { id: string };
      parts: Array<{ type: string; text?: string }>;
    };
    const textResult = resultData.parts ? extractTextFromParts(resultData.parts) : null;

    log(`Query completed. Result length: ${textResult?.length || 0}`);

    writeOutput({
      status: 'success',
      result: textResult,
      newSessionId: currentSessionId,
    });

    // Process any IPC messages that arrived during the query
    for (const text of ipcQueue) {
      if (closedDuringQuery) break;
      log(`Processing queued IPC message (${text.length} chars)`);
      try {
        const followupResult = await client.session.prompt({
          path: { id: currentSessionId! },
          body: { parts: [{ type: 'text', text }] },
        });
        const followupData = followupResult as unknown as {
          parts: Array<{ type: string; text?: string }>;
        };
        const followupText = followupData.parts ? extractTextFromParts(followupData.parts) : null;
        writeOutput({
          status: 'success',
          result: followupText,
          newSessionId: currentSessionId,
        });
      } catch (err) {
        log(`Warning: Failed to process IPC message: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    log(`Query error: ${errorMessage}`);
    writeOutput({
      status: 'error',
      result: null,
      newSessionId: currentSessionId,
      error: errorMessage,
    });
  }

  ipcPolling = false;
  return { newSessionId: currentSessionId, closedDuringQuery };
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  let containerInput: ContainerInput;

  try {
    const stdinData = await readStdin();
    containerInput = JSON.parse(stdinData);
    try { fs.unlinkSync('/tmp/input.json'); } catch { /* may not exist */ }
    log(`Received input for group: ${containerInput.groupFolder}`);
  } catch (err) {
    writeOutput({
      status: 'error',
      result: null,
      error: `Failed to parse input: ${err instanceof Error ? err.message : String(err)}`
    });
    process.exit(1);
  }

  // Apply secrets to environment for the OpenCode server to pick up.
  // OpenCode reads API keys from standard environment variables:
  //   OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY, etc.
  for (const [key, value] of Object.entries(containerInput.secrets || {})) {
    process.env[key] = value;
  }

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const mcpServerPath = path.join(__dirname, 'ipc-mcp-stdio.js');

  // Write opencode config to the working directory
  const opencodeConfig = buildOpencodeConfig(containerInput, mcpServerPath);
  const configPath = '/workspace/group/opencode.json';
  fs.writeFileSync(configPath, JSON.stringify({
    '$schema': 'https://opencode.ai/config.json',
    ...opencodeConfig,
  }, null, 2));
  log(`Wrote OpenCode config to ${configPath}`);

  // Start OpenCode server and create client
  log('Starting OpenCode server...');
  let client: ReturnType<typeof createOpencodeClient>;
  let serverClose: (() => void) | undefined;

  try {
    const opencode = await createOpencode({
      hostname: '127.0.0.1',
      port: OPENCODE_PORT,
      config: opencodeConfig,
    });
    client = opencode.client;
    serverClose = () => opencode.server.close();
    log(`OpenCode server started at http://127.0.0.1:${OPENCODE_PORT}`);
  } catch (err) {
    writeOutput({
      status: 'error',
      result: null,
      error: `Failed to start OpenCode server: ${err instanceof Error ? err.message : String(err)}`
    });
    process.exit(1);
  }

  let sessionId = containerInput.sessionId;
  fs.mkdirSync(IPC_INPUT_DIR, { recursive: true });

  // Clean up stale _close sentinel from previous container runs
  try { fs.unlinkSync(IPC_INPUT_CLOSE_SENTINEL); } catch { /* ignore */ }

  // Build initial prompt (drain any pending IPC messages too)
  let prompt = containerInput.prompt;
  if (containerInput.isScheduledTask) {
    prompt = `[SCHEDULED TASK - The following message was sent automatically and is not coming directly from the user or group.]\n\n${prompt}`;
  }
  const pending = drainIpcInput();
  if (pending.length > 0) {
    log(`Draining ${pending.length} pending IPC messages into initial prompt`);
    prompt += '\n' + pending.join('\n');
  }

  // Query loop: run query → wait for IPC message → run new query → repeat
  try {
    while (true) {
      log(`Starting query (session: ${sessionId || 'new'})...`);

      const queryResult = await runQuery(client, prompt, sessionId, containerInput);
      if (queryResult.newSessionId) {
        sessionId = queryResult.newSessionId;
      }

      if (queryResult.closedDuringQuery) {
        log('Close sentinel consumed during query, exiting');
        break;
      }

      // Emit session update so host can track it
      writeOutput({ status: 'success', result: null, newSessionId: sessionId });

      log('Query ended, waiting for next IPC message...');

      const nextMessage = await waitForIpcMessage();
      if (nextMessage === null) {
        log('Close sentinel received, exiting');
        break;
      }

      log(`Got new message (${nextMessage.length} chars), starting new query`);
      prompt = nextMessage;
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    log(`Agent error: ${errorMessage}`);
    writeOutput({
      status: 'error',
      result: null,
      newSessionId: sessionId,
      error: errorMessage
    });
    process.exit(1);
  } finally {
    // Archive the conversation before shutting down
    if (sessionId) {
      await archiveSession(client, sessionId, containerInput.assistantName);
    }
    // Shut down the OpenCode server
    if (serverClose) {
      try {
        serverClose();
        log('OpenCode server shut down');
      } catch { /* ignore */ }
    }
  }
}

main();
