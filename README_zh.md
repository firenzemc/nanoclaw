<p align="center">
  <img src="assets/nanoclaw-logo.png" alt="NanoClaw" width="400">
</p>

<p align="center">
  一个在独立容器中安全运行 AI 代理的助手。轻量、易于理解、完全可定制。
</p>

<p align="center">
  <b>OpenCode 版</b> — 使用 <a href="https://opencode.ai">OpenCode</a> 替代 Claude Code 的提供商无关分支
</p>

## 变更说明（OpenCode 版）

这是 [NanoClaw](https://github.com/qwibitai/nanoclaw) 的一个分支，将 Anthropic Claude Code 依赖替换为 [OpenCode](https://github.com/anomalyco/opencode) — 一个提供商无关的 AI 编码代理。

**与上游的主要区别：**

| 方面 | 原版 NanoClaw | OpenCode 版 |
|------|-------------|------------|
| AI 引擎 | Claude Code（仅 Anthropic） | OpenCode（任意提供商） |
| SDK | `@anthropic-ai/claude-agent-sdk` | `@opencode-ai/sdk` |
| API 密钥 | 仅 `ANTHROPIC_API_KEY` | OpenAI、Gemini、Groq、Anthropic、OpenRouter、xAI、本地模型 |
| 容器 CLI | `@anthropic-ai/claude-code` | `opencode-ai` |
| 上下文文件 | 仅 `CLAUDE.md` | `OPENCODE.md`（兼容 `CLAUDE.md`） |

**其他所有功能保持不变：** 容器隔离、IPC 机制、MCP 工具、WhatsApp 集成、定时任务、群组管理、技能系统和整体架构。

## 快速开始

```bash
git clone <this-repo>
cd nanoclaw-opencode

# 配置你偏好的 AI 提供商
cp .env.example .env
# 编辑 .env 并设置至少一个 API 密钥（如 OPENAI_API_KEY）

npm install
npm run build

# 构建容器镜像
cd container && ./build.sh && cd ..

npm start
```

## 支持的 AI 提供商

| 提供商 | 环境变量 | 示例模型 |
|--------|---------|---------|
| OpenAI | `OPENAI_API_KEY` | gpt-4.1, gpt-4o, o3 |
| Google Gemini | `GEMINI_API_KEY` | gemini-2.5-pro, gemini-2.5-flash |
| Anthropic | `ANTHROPIC_API_KEY` | claude-sonnet-4, claude-haiku-3.5 |
| Groq | `GROQ_API_KEY` | llama-4-maverick, qwen-qwq |
| OpenRouter | `OPENROUTER_API_KEY` | OpenRouter 上的任意模型 |
| xAI | `XAI_API_KEY` | grok-3 |
| 本地模型 | （无需密钥） | Ollama, LM Studio 等 |

## 设计哲学

继承自原版 NanoClaw：

**小到可以理解。** 一个进程，几个源文件，没有微服务。

**通过隔离保证安全。** 代理在 Linux 容器中运行，只能看到显式挂载的目录。

**为个人用户构建。** NanoClaw 设计为定制化的——创建你自己的分支并修改它以匹配你的需求。

本分支新增：

**提供商无关。** 你的 AI 助手不应该把你锁定在单一供应商。通过配置更改切换模型，而不是重写代码。

## 架构

```
WhatsApp (baileys) --> SQLite --> 轮询循环 --> 容器 (OpenCode SDK) --> 响应
```

单个 Node.js 进程。代理在隔离的 Linux 容器中执行。仅挂载的目录可访问。每组消息队列带并发控制。通过文件系统进行 IPC。

## 许可证

MIT
