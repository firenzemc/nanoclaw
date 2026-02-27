# Intent: Modify index.ts to integrate the Feishu channel

Changes from the base `src/index.ts`:

1. **Import `FeishuChannel`** from `./channels/feishu.js`
2. **Import Feishu config vars** (`FEISHU_APP_ID`, `FEISHU_APP_SECRET`, `FEISHU_ONLY`) from `./config.js`
3. **Instantiate and connect Feishu channel** in `main()` when `FEISHU_APP_ID` and `FEISHU_APP_SECRET` are set
4. **Respect `FEISHU_ONLY` flag** — when true, skip WhatsApp channel initialization
5. All other logic (message loop, group queue, IPC watcher, scheduler) is unchanged

The Feishu channel uses the same `Channel` interface as WhatsApp and Telegram, so no changes to the message routing logic are required.
