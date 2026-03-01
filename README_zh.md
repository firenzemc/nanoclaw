# NanoClaw (OpenCode 版)

<p align="center">
  <img src="assets/nanoclaw-logo.png" alt="NanoClaw" width="400">
</p>

<p align="center">
  一个在独立容器中安全运行 AI 代理的助手。轻量、易于理解、完全可定制。<br>
  这是 <a href="https://github.com/qwibitai/nanoclaw">NanoClaw</a> 的 OpenCode 改造版，原始中文说明请见 <a href="https://github.com/qwibitai/nanoclaw/blob/main/README_zh.md">这里</a>。
</p>

## 为什么选择这个分支

这是 [NanoClaw](https://github.com/qwibitai/nanoclaw) 的一个分支，它将对 Anthropic Claude Code 的硬依赖替换为 [OpenCode](https://github.com/anomalyco/opencode) — 一个开源、提供商无关的 AI 编码代理。这种改造解耦了 AI 引擎，使您能够：

1.  **自由选择提供商** — 使用 OpenAI、Gemini、Groq 或任何其他支持的模型。
2.  **降低成本** — 为简单任务切换到更经济的模型。
3.  **保持灵活性** — 不被锁定在单一供应商的生态系统中。
4.  **使用本地模型** — 通过 Ollama 或 LM Studio 实现完全离线运行。

### 与原版的主要区别

| 方面 | 原版 NanoClaw | OpenCode 版 |
| :--- | :--- | :--- |
| **AI 引擎** | Claude Code (仅限 Anthropic) | OpenCode (任意提供商) |
| **SDK** | `@anthropic-ai/claude-agent-sdk` | `@opencode-ai/sdk` |
| **API 密钥** | 仅 `ANTHROPIC_API_KEY` | `OPENAI_API_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY`, 等 |
| **容器 CLI** | `@anthropic-ai/claude-code` | `opencode-ai` |
| **上下文文件** | `CLAUDE.md` | `OPENCODE.md` (兼容 `CLAUDE.md`) |

此分支保留了原版的所有核心功能：容器隔离、IPC 机制、MCP 工具、WhatsApp 集成、定时任务、群组管理和整体架构。

## 快速开始

```bash
# 克隆本仓库
git clone https://github.com/firenzemc/nanoclaw.git
cd nanoclaw

# 切换到 OpenCode 分支
git checkout feature/opencode-migration

# 安装依赖
npm install

# 配置环境
cp .env.example .env
# 编辑 .env 文件并设置至少一个 AI 提供商的 API 密钥

# 构建项目和容器
npm run build
cd container && ./build.sh && cd ..

# 启动服务
npm start
```

## 支持的 AI 提供商

| 提供商 | 环境变量 | 示例模型 |
| :--- | :--- | :--- |
| OpenAI | `OPENAI_API_KEY` | `gpt-4.1-mini`, `gpt-4o` |
| Google | `GEMINI_API_KEY` | `gemini-1.5-pro`, `gemini-1.5-flash` |
| Anthropic | `ANTHROPIC_API_KEY` | `claude-3-sonnet`, `claude-3.5-sonnet` |
| Groq | `GROQ_API_KEY` | `llama3-70b-8192` |
| OpenRouter | `OPENROUTER_API_KEY` | OpenRouter 上的任意模型 |
| xAI | `XAI_API_KEY` | `grok-1.5-flash` |
| 本地模型 | (无需) | Ollama, LM Studio, 等 |

您可以在项目根目录或各群组的 `opencode.json` 文件中配置您偏好的模型。

## 设计哲学

继承自原版 NanoClaw：

*   **小巧易懂:** 单一进程，少量源文件，无微服务、无消息队列、无复杂抽象层。
*   **通过隔离保障安全:** 智能体运行在 Linux 容器中，只能看到被明确挂载的内容。
*   **为单一用户打造:** 这是一个完全符合个人需求的、可工作的软件，而非一个框架。
*   **定制即代码修改:** 没有繁杂的配置文件。想要不同的行为？直接修改代码。

本分支新增：

*   **提供商无关:** 您的 AI 助手不应该将您锁定在单一供应商。通过配置更改即可切换模型，无需重写代码。

## 功能支持

*   **多渠道输入/输出** - 支持 WhatsApp, Telegram, Discord, Slack, Signal 及无头模式。
*   **隔离的群组上下文** - 每个群组都拥有独立的 `OPENCODE.md` (或兼容的 `CLAUDE.md`) 记忆和隔离的文件系统，在各自的容器沙箱中运行。
*   **主频道** - 您的私有频道（self-chat），用于管理控制；其他所有群组都完全隔离。
*   **计划任务** - 运行周期性作业，并可以给您回发消息。
*   **网络访问** - 搜索和抓取网页内容。
*   **容器隔离** - 智能体在 Docker (macOS/Linux) 或 Apple Container (macOS) 的沙箱中运行。
*   **MCP 工具** - 完全支持 MCP (模型上下文协议)，实现可扩展的工具使用。
*   **Twitter/X 数据** - 通过 6551 API 查询用户资料、推文、搜索、关注者、已删除推文和 KOL 关注者（OpenTwitter 技能）。
*   **加密货币新闻** - 通过 6551 API 搜索加密新闻，含 AI 评级、交易信号和来源过滤（OpenNews 技能）。
*   **可选集成** - 通过技能添加 Gmail (`/add-gmail`) 等更多功能。

## 使用方法

使用触发词（默认为 `@Andy`）与您的助手对话：

```
@Andy 每周一到周五早上9点，给我发一份销售渠道的概览
@Andy 每周五回顾过去一周的 git 历史，如果与 README 有出入，就更新它
@Andy 每周一早上8点，编译关于 AI 发展的资讯，然后发给我一份简报
```

在主频道（您的 self-chat）中，可以管理群组和任务：

```
@Andy 列出所有群组的计划任务
@Andy 暂停周一简报任务
@Andy 加入“家庭聊天”群组
```

## 架构

```
WhatsApp (baileys) --> SQLite --> 轮询循环 --> 容器 (OpenCode SDK) --> 响应
```

采用单一 Node.js 进程。智能体在具有文件系统隔离的独立 Linux 容器中执行。仅被挂载的目录可被访问。每个群组拥有独立的消息队列和并发控制。通过文件系统进行进程间通信（IPC）。

**关键文件:**

*   `src/index.ts` - 编排器：状态管理、消息循环、智能体调用
*   `src/channels/whatsapp.ts` - WhatsApp 连接、认证、收发消息
*   `src/ipc.ts` - IPC 监听与任务处理
*   `src/router.ts` - 消息格式化与出站路由
*   `src/group-queue.ts` - 各带全局并发限制的群组队列
*   `src/container-runner.ts` - 生成流式智能体容器
*   `container/agent-runner/src/index.ts` - 容器内的代理，使用 OpenCode SDK
*   `groups/*/OPENCODE.md` - 各群组的记忆 (兼容 `CLAUDE.md`)

## FAQ

**问：为什么使用 OpenCode 替代 Claude Code？**
答：OpenCode 是提供商无关、开源的，并支持相同的核心能力（bash、文件编辑、网络访问、MCP）。它让您可以自由选择 AI 提供商，而不是被锁定在 Anthropic 生态中。

**问：我还能使用 Claude/Anthropic 吗？**
答：可以。OpenCode 支持 Anthropic 作为众多提供商之一。在您的 `.env` 文件中设置 `ANTHROPIC_API_KEY` 并在 `opencode.json` 中配置相应模型即可。

**问：这个分支与原版 NanoClaw 兼容吗？**
答：是的。IPC 协议、MCP 工具、容器隔离及整体架构都保持不变。为了向后兼容，上下文文件 (`CLAUDE.md`) 仍然被支持。主要区别在于容器内运行的 AI 引擎。

**问：如何切换模型？**
答：编辑项目根目录或特定群组目录下的 `opencode.json` 配置文件。OpenCode 支持按提供商配置模型。

## 贡献

遵循与原版 NanoClaw 相同的哲学：贡献技能，而非功能。

## 许可证

MIT
