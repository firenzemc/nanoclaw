---
name: add-feishu
description: Add Feishu (飞书/Lark) as a messaging channel. Can replace WhatsApp entirely or run alongside it. Uses the official @larksuiteoapi/node-sdk with WebSocket long connection — no public URL required.
---

# Add Feishu Channel (飞书集成)

This skill adds Feishu/Lark Bot support to NanoClaw using the skills engine for deterministic code changes, then walks through interactive setup.

## Phase 1: Pre-flight

### Check if already applied

Read `.nanoclaw/state.yaml`. If `feishu` is in `applied_skills`, skip to Phase 3 (Setup). The code changes are already in place.

### Ask the user

Use `AskUserQuestion` to collect configuration:

AskUserQuestion: Should Feishu replace WhatsApp or run alongside it?
- **Replace WhatsApp** - Feishu will be the only channel (sets FEISHU_ONLY=true)
- **Alongside** - Both Feishu and WhatsApp channels active

AskUserQuestion: Do you have a Feishu App ID and App Secret, or do you need to create a Feishu app?

If they have credentials, collect them now. If not, we'll create the app in Phase 3.

## Phase 2: Apply Code Changes

Run the skills engine to apply this skill's code package. The package files are in this directory alongside this SKILL.md.

### Initialize skills system (if needed)

If `.nanoclaw/` directory doesn't exist yet:

```bash
npx tsx scripts/apply-skill.ts --init
```

Or call `initSkillsSystem()` from `skills-engine/migrate.ts`.

### Apply the skill

```bash
npx tsx scripts/apply-skill.ts .claude/skills/add-feishu
```

This deterministically:
- Adds `src/channels/feishu.ts` (FeishuChannel class implementing Channel interface)
- Adds `src/channels/feishu.test.ts` (comprehensive unit tests)
- Three-way merges Feishu support into `src/index.ts` (multi-channel support, findChannel routing)
- Three-way merges Feishu config into `src/config.ts` (FEISHU_APP_ID, FEISHU_APP_SECRET, FEISHU_ONLY exports)
- Three-way merges updated routing tests into `src/routing.test.ts`
- Installs the `@larksuiteoapi/node-sdk` npm dependency
- Records the application in `.nanoclaw/state.yaml`

If the apply reports merge conflicts, read the intent files:
- `modify/src/index.ts.intent.md` — what changed and invariants for index.ts
- `modify/src/config.ts.intent.md` — what changed for config.ts

### Validate code changes

```bash
npm test
npm run build
```

All tests must pass (including the new feishu tests) and build must be clean before proceeding.

## Phase 3: Setup

### Create Feishu App (if needed)

If the user doesn't have a Feishu App ID and Secret, tell them:

> I need you to create a Feishu enterprise self-built application:
>
> 1. Go to the Feishu Open Platform Developer Console: https://open.feishu.cn/app
> 2. Click **Create Enterprise Self-Built Application** (创建企业自建应用)
> 3. Fill in:
>    - App Name: e.g., "Andy AI Assistant"
>    - App Description: e.g., "AI agent powered by NanoClaw"
> 4. Click **Create** — you'll see your **App ID** and **App Secret** on the Credentials page
> 5. In the left sidebar, go to **Add Capabilities** (添加应用能力) → enable **Bot** (机器人)
> 6. Go to **Event Subscriptions** (事件订阅):
>    - Enable **Use Long Connection to Receive Events** (使用长连接接收事件)
>    - Click **Add Event** (添加事件) → search for **Receive Messages** (接收消息 `im.message.receive_v1`) → subscribe
> 7. Go to **Permissions & Scopes** (权限管理) and enable:
>    - `im:message` — Read messages
>    - `im:message:send_as_bot` — Send messages as bot
>    - `im:chat` — Access chat info
>    - `im:chat.group_info:readonly` — Read group chat info (optional, for group name resolution)
> 8. Go to **Version Management & Release** (版本管理与发布) → create a version and **Submit for Release** (提交发布)
>    - For enterprise self-built apps, approval is usually automatic
>
> Copy the **App ID** (starts with `cli_`) and **App Secret**.

Wait for the user to provide the App ID and App Secret.

### Configure environment

Add to `.env`:

```bash
FEISHU_APP_ID=cli_xxxxxxxxxxxxxxxx
FEISHU_APP_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

If they chose to replace WhatsApp:

```bash
FEISHU_ONLY=true
```

Sync to container environment:

```bash
mkdir -p data/env && cp .env data/env/env
```

The container reads environment from `data/env/env`, not `.env` directly.

### Add bot to chats

Tell the user:

> **For group chats**: In Feishu, open the group → click the group name at the top → **Settings** → **Bots** → **Add Bot** → search for your app name and add it.
>
> **For private chats**: Users can find the bot by searching for the app name in Feishu and starting a conversation.

### Build and restart

```bash
npm run build
launchctl kickstart -k gui/$(id -u)/com.nanoclaw  # macOS
# Linux: systemctl --user restart nanoclaw
```

## Phase 4: Registration

### Get Chat ID

Tell the user:

> 1. In the Feishu chat (group or private), send the message: `/chatid`
> 2. The bot will reply with the chat ID in the format `feishu:oc_xxxxxxxxxxxxxxxx`
> 3. Copy that full ID including the `feishu:` prefix

Wait for the user to provide the chat ID.

### Register the chat

Use the IPC register flow or register directly. The chat ID, name, and folder name are needed.

For a main chat (responds to all messages, uses the `main` folder):

```typescript
registerGroup("feishu:oc_<chat-id>", {
  name: "<chat-name>",
  folder: "main",
  trigger: `@${ASSISTANT_NAME}`,
  added_at: new Date().toISOString(),
  requiresTrigger: false,
});
```

For additional chats (trigger-only, requires @mention):

```typescript
registerGroup("feishu:oc_<chat-id>", {
  name: "<chat-name>",
  folder: "<folder-name>",
  trigger: `@${ASSISTANT_NAME}`,
  added_at: new Date().toISOString(),
  requiresTrigger: true,
});
```

**Note on triggers in Feishu groups**: When `requiresTrigger: true`, users must @mention the bot in the group to trigger a response. The bot's @mention in Feishu is automatically translated to the `@AssistantName` trigger pattern.

## Phase 5: Verify

### Test the connection

Tell the user:

> Send a message to your registered Feishu chat:
> - For main chat (requiresTrigger: false): Any message works
> - For non-main chats: @mention the bot in the group
>
> The bot should respond within a few seconds.

### Check logs if needed

```bash
tail -f logs/nanoclaw.log
```

## Troubleshooting

### Bot not responding

Check:
1. `FEISHU_APP_ID` and `FEISHU_APP_SECRET` are set in `.env` AND synced to `data/env/env`
2. Chat is registered in SQLite:
   ```bash
   sqlite3 store/messages.db "SELECT * FROM registered_groups WHERE jid LIKE 'feishu:%'"
   ```
3. The app has been published and approved in Feishu Open Platform
4. The bot has been added to the group/chat
5. Event subscription for `im.message.receive_v1` is enabled with **Long Connection** mode
6. Required permissions (`im:message`, `im:message:send_as_bot`) are granted
7. Service is running:
   ```bash
   launchctl list | grep nanoclaw  # macOS
   systemctl --user status nanoclaw  # Linux
   ```

### Bot not receiving group messages

- Ensure the bot has been added to the group (group settings → bots → add bot)
- Ensure `im.message.receive_v1` event is subscribed in the Developer Console
- Check that the app version has been published

### Getting chat ID manually

If `/chatid` doesn't work, you can find the chat ID via the Feishu Open Platform API:
```bash
curl -X GET "https://open.feishu.cn/open-apis/im/v1/chats" \
  -H "Authorization: Bearer $(curl -s -X POST https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal \
    -H 'Content-Type: application/json' \
    -d '{"app_id":"YOUR_APP_ID","app_secret":"YOUR_APP_SECRET"}' | jq -r '.tenant_access_token')"
```

### WebSocket connection issues

The Feishu channel uses WebSocket long connection (persistent connection) instead of HTTP webhooks. This means:
- No public URL is required
- The connection is established outbound from your server
- If the connection drops, the SDK will automatically reconnect
- Check firewall rules allow outbound connections to `open.feishu.cn` on port 443

## After Setup

If running `npm run dev` while the service is active:
```bash
# macOS:
launchctl unload ~/Library/LaunchAgents/com.nanoclaw.plist
npm run dev
# When done testing:
launchctl load ~/Library/LaunchAgents/com.nanoclaw.plist

# Linux:
systemctl --user stop nanoclaw
npm run dev
systemctl --user start nanoclaw
```

## Removal

To remove Feishu integration:

1. Delete `src/channels/feishu.ts`
2. Remove `FeishuChannel` import and creation from `src/index.ts`
3. Remove Feishu config (`FEISHU_APP_ID`, `FEISHU_APP_SECRET`, `FEISHU_ONLY`) from `src/config.ts`
4. Remove Feishu registrations from SQLite:
   ```bash
   sqlite3 store/messages.db "DELETE FROM registered_groups WHERE jid LIKE 'feishu:%'"
   ```
5. Uninstall: `npm uninstall @larksuiteoapi/node-sdk`
6. Rebuild:
   ```bash
   npm run build
   launchctl kickstart -k gui/$(id -u)/com.nanoclaw  # macOS
   # Linux: systemctl --user restart nanoclaw
   ```
