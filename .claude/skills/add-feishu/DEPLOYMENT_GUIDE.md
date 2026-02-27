# Nanoclaw 飞书 (Feishu/Lark) 集成部署指南

本文档将指导你如何为 Nanoclaw 设置和配置飞书集成。集成通过 Nanoclaw 的 skills 机制实现，使用 WebSocket 长连接，无需公网 IP 或 Webhook URL。

## 状态

- **代码完成度**: 100%
- **测试覆盖率**: 核心功能已通过单元测试
- **文档完整性**: 完整

所有相关代码和文档均已准备就绪。

## 步骤 1: 应用 Skill

首先，使用 Nanoclaw 的 skills-engine 应用 `add-feishu` skill。这将自动修改源代码以添加飞书支持。

在你的 Nanoclaw 项目根目录下运行：

```bash
# 如果是首次使用 skill，请先初始化
# npx tsx skills-engine/index.ts --init

# 应用 feishu skill
npx tsx skills-engine/index.ts apply .claude/skills/add-feishu
```

该命令会自动完成以下操作：
1.  安装 npm 依赖 `@larksuiteoapi/node-sdk`。
2.  添加 `src/channels/feishu.ts` 和 `src/channels/feishu.test.ts` 文件。
3.  修改 `src/index.ts` 和 `src/config.ts` 以集成飞书频道。
4.  更新 `.nanoclaw/state.yaml` 以记录 skill 应用状态。

应用成功后，运行测试和构建以确保一切正常：

```bash
npm test
npm run build
```

## 步骤 2: 创建并配置飞书机器人

1.  **创建应用**: 访问 [飞书开放平台](https://open.feishu.cn/app)，点击 **创建企业自建应用**。
    -   填写应用名称（例如：“AI 助手”）和描述。
    -   创建后，在 **凭证与基础信息** 页面找到你的 **App ID** 和 **App Secret**。

2.  **启用机器人能力**: 在左侧菜单中，进入 **应用能力** -> **添加应用能力**，然后启用 **机器人**。

3.  **配置事件订阅**: 
    -   进入 **事件订阅** 页面。
    -   在 **连接方式** 中，选择 **使用长连接接收事件** (Use Long Connection to Receive Events)。
    -   点击 **添加事件**，搜索并订阅 **接收消息 (im.message.receive_v1)**。

4.  **配置权限**: 
    -   进入 **权限管理** 页面。
    -   搜索并开通以下权限：
        -   `im:message` (读取消息)
        -   `im:message:send_as_bot` (以机器人身份发送消息)
        -   `im:chat` (获取群组信息)

5.  **发布应用**: 
    -   进入 **版本管理与发布** 页面。
    -   创建一个新版本并 **提交发布**。企业自建应用通常会自动通过审核。

## 步骤 3: 配置环境变量

在你的 Nanoclaw 项目根目录下，编辑 `.env` 文件，添加你的飞书应用凭证：

```env
# .env

# ... 其他配置 ...

# Feishu Bot Configuration
FEISHU_APP_ID="cli_xxxxxxxxxxxxxxxx"
FEISHU_APP_SECRET="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# 如果你只想使用飞书作为唯一的消息通道，请取消下面的注释
# FEISHU_ONLY=true
```

-   将 `cli_...` 和 `xxx...` 替换为你在上一步中获得的真实 App ID 和 App Secret。
-   如果设置 `FEISHU_ONLY=true`，Nanoclaw 将不会启动 WhatsApp 通道。

## 步骤 4: 重启 Nanoclaw

保存 `.env` 文件后，重新构建并启动 Nanoclaw 服务以使更改生效。

```bash
# 重新构建代码
npm run build

# 重启服务 (以 macOS 为例)
launchctl kickstart -k gui/$(id -u)/com.nanoclaw

# Linux 用户请使用:
# systemctl --user restart nanoclaw
```

## 步骤 5: 注册聊天

为了让 Nanoclaw 在指定的聊天中接收和发送消息，你需要注册该聊天。

1.  **获取 Chat ID**:
    -   **私聊**: 在飞书中搜索你的机器人并向它发送任意消息。
    -   **群聊**: 将你的机器人添加到目标群聊中。
    -   在对应的聊天（私聊或群聊）中，发送消息 `/chatid`。
    -   机器人会自动回复该聊天的 ID，格式为 `feishu:oc_xxxxxxxxxxxxxxxx`。

2.  **注册聊天**: 
    -   获取 Chat ID 后，你需要将其注册到 Nanoclaw。这通常通过一个管理界面或 IPC 调用完成。注册时需要提供 Chat ID、一个名称以及一个用于存放相关数据的文件夹名称。
    -   例如，注册一个主聊天（会响应所有消息）:
        ```json
        {
          "action": "register_group",
          "payload": {
            "jid": "feishu:oc_xxxxxxxxxxxxxxxx",
            "name": "我的主聊天",
            "folder": "main",
            "requiresTrigger": false
          }
        }
        ```

## 步骤 6: 验证

向你已注册的飞书聊天发送一条消息。

-   如果注册为 **主聊天** (`requiresTrigger: false`)，发送任意消息，机器人都应响应。
-   如果注册为 **普通聊天** (`requiresTrigger: true`)，你需要在群聊中 **@你的机器人** 并提问，它才会响应。

如果一切顺利，你的 Nanoclaw AI 助手现在应该可以通过飞书进行交互了。

## 问题排查

-   **机器人不回复**: 
    -   检查 `.env` 文件中的 `FEISHU_APP_ID` 和 `FEISHU_APP_SECRET` 是否正确。
    -   确认应用已在飞书开放平台发布。
    -   确认机器人已被添加到相应的群聊中。
    -   检查 `im.message.receive_v1` 事件是否已通过 **长连接** 方式订阅。
    -   检查 `logs/nanoclaw.log` 文件以获取详细的错误信息。
-   **`/chatid` 命令无响应**: 
    -   确保 Nanoclaw 服务正在运行。
    -   检查日志，确认飞书 WebSocket 连接是否成功建立。
