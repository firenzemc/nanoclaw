# Intent: Modify config.ts to add Feishu configuration

Add three new environment variables for the Feishu channel:

1. `FEISHU_APP_ID` — The App ID from Feishu Open Platform Developer Console
2. `FEISHU_APP_SECRET` — The App Secret from Feishu Open Platform Developer Console
3. `FEISHU_ONLY` — When set to `true`, disables the WhatsApp channel and runs Feishu exclusively

These are read from both `.env` file and `process.env`, following the same pattern as other config values.
