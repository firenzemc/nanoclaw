import * as lark from '@larksuiteoapi/node-sdk';

import { ASSISTANT_NAME, TRIGGER_PATTERN } from '../config.js';
import { logger } from '../logger.js';
import {
  Channel,
  OnChatMetadata,
  OnInboundMessage,
  RegisteredGroup,
} from '../types.js';

export interface FeishuChannelOpts {
  onMessage: OnInboundMessage;
  onChatMetadata: OnChatMetadata;
  registeredGroups: () => Record<string, RegisteredGroup>;
}

export class FeishuChannel implements Channel {
  name = 'feishu';

  private client: lark.Client | null = null;
  private wsClient: lark.WSClient | null = null;
  private opts: FeishuChannelOpts;
  private appId: string;
  private appSecret: string;
  private connected = false;

  // Cache bot's open_id so we can detect self-sent messages
  private botOpenId: string | null = null;

  constructor(appId: string, appSecret: string, opts: FeishuChannelOpts) {
    this.appId = appId;
    this.appSecret = appSecret;
    this.opts = opts;
  }

  async connect(): Promise<void> {
    // Create the API client for sending messages
    this.client = new lark.Client({
      appId: this.appId,
      appSecret: this.appSecret,
      appType: lark.AppType.SelfBuild,
      domain: lark.Domain.Feishu,
    });

    // Fetch bot info to get our own open_id
    try {
      const botInfo = await this.client.bot.v3.botInfo.get();
      if (botInfo?.data?.bot) {
        this.botOpenId = botInfo.data.bot.open_id || null;
        logger.info(
          { botName: botInfo.data.bot.app_name, openId: this.botOpenId },
          'Feishu bot info retrieved',
        );
      }
    } catch (err) {
      logger.warn({ err }, 'Failed to fetch Feishu bot info, continuing without self-detection');
    }

    // Create event dispatcher for receiving messages
    const eventDispatcher = new lark.EventDispatcher({}).register({
      'im.message.receive_v1': async (data: any) => {
        await this.handleMessageEvent(data);
      },
    });

    // Create WebSocket client for long connection (no public URL needed)
    this.wsClient = new lark.WSClient({
      appId: this.appId,
      appSecret: this.appSecret,
      loggerLevel: lark.LoggerLevel.info,
    });

    // Start WebSocket connection
    return new Promise<void>((resolve) => {
      this.wsClient!.start({
        eventDispatcher,
      });

      // WSClient.start() does not provide a callback for connection established,
      // so we mark as connected after a brief delay to allow handshake
      setTimeout(() => {
        this.connected = true;
        logger.info('Feishu bot connected via WebSocket');
        console.log(`\n  Feishu bot connected (App ID: ${this.appId})`);
        console.log(
          `  Send /chatid to the bot to get a chat's registration ID\n`,
        );
        resolve();
      }, 2000);
    });
  }

  private async handleMessageEvent(data: any): Promise<void> {
    try {
      const message = data.message;
      if (!message) return;

      const chatId = message.chat_id;
      const chatType = message.chat_type; // 'p2p' or 'group'
      const messageId = message.message_id;
      const messageType = message.message_type; // 'text', 'image', etc.
      const createTime = message.create_time; // Unix timestamp in ms

      // Get sender info
      const sender = data.sender;
      const senderOpenId = sender?.sender_id?.open_id || '';
      const senderType = sender?.sender_type || ''; // 'user' or 'bot'

      // Skip messages from bots (including self)
      if (senderType === 'bot') return;

      // Build timestamp
      const timestamp = createTime
        ? new Date(parseInt(createTime, 10)).toISOString()
        : new Date().toISOString();

      // Build chat JID with feishu prefix
      const chatJid = `feishu:${chatId}`;
      const isGroup = chatType === 'group';

      // Extract text content
      let content = '';
      if (messageType === 'text') {
        try {
          const parsed = JSON.parse(message.content);
          content = parsed.text || '';
        } catch {
          content = message.content || '';
        }
      } else {
        // Non-text messages get a placeholder
        const placeholders: Record<string, string> = {
          image: '[Image]',
          audio: '[Audio]',
          video: '[Video]',
          file: '[File]',
          sticker: '[Sticker]',
          share_chat: '[Shared Chat]',
          share_user: '[Shared User]',
          location: '[Location]',
          post: '[Rich Text]',
          interactive: '[Interactive Card]',
          merge_forward: '[Merged Forward]',
        };
        content = placeholders[messageType] || `[${messageType}]`;
      }

      if (!content) return;

      // Handle /chatid command
      if (content.trim() === '/chatid') {
        await this.sendMessage(chatJid, `Chat ID: \`feishu:${chatId}\`\nType: ${chatType}`);
        return;
      }

      // Handle /ping command
      if (content.trim() === '/ping') {
        await this.sendMessage(chatJid, `${ASSISTANT_NAME} is online.`);
        return;
      }

      // Resolve sender name
      let senderName = 'Unknown';
      if (sender?.sender_id?.open_id && this.client) {
        try {
          // Try to get user info from mentions in the message
          const mentions = message.mentions;
          if (mentions) {
            // If the sender is mentioned, we can get their name
            for (const mention of mentions) {
              if (mention.id?.open_id === senderOpenId) {
                senderName = mention.name || senderName;
                break;
              }
            }
          }
          // Fallback: use open_id as sender name if we couldn't resolve it
          if (senderName === 'Unknown') {
            senderName = senderOpenId.slice(0, 12) || 'Unknown';
          }
        } catch {
          senderName = senderOpenId.slice(0, 12) || 'Unknown';
        }
      }

      // In group chats, handle @mention of the bot as trigger
      if (isGroup && message.mentions) {
        const isBotMentioned = message.mentions.some(
          (m: any) => m.id?.open_id === this.botOpenId,
        );
        if (isBotMentioned && !TRIGGER_PATTERN.test(content)) {
          // Remove the @bot mention text and prepend the trigger
          for (const mention of message.mentions) {
            if (mention.id?.open_id === this.botOpenId && mention.key) {
              content = content.replace(mention.key, '').trim();
            }
          }
          content = `@${ASSISTANT_NAME} ${content}`;
        }
      }

      // Determine chat name
      let chatName = chatJid;
      if (chatType === 'p2p') {
        chatName = senderName;
      } else if (isGroup) {
        // For groups, try to get the chat name
        chatName = `Feishu Group ${chatId.slice(0, 8)}`;
      }

      // Store chat metadata for discovery
      this.opts.onChatMetadata(chatJid, timestamp, chatName, 'feishu', isGroup);

      // Only deliver full message for registered groups
      const group = this.opts.registeredGroups()[chatJid];
      if (!group) {
        logger.debug(
          { chatJid, chatName },
          'Message from unregistered Feishu chat',
        );
        return;
      }

      // Deliver message — startMessageLoop() will pick it up
      this.opts.onMessage(chatJid, {
        id: messageId,
        chat_jid: chatJid,
        sender: senderOpenId,
        sender_name: senderName,
        content,
        timestamp,
        is_from_me: false,
      });

      logger.info(
        { chatJid, chatName, sender: senderName },
        'Feishu message stored',
      );
    } catch (err) {
      logger.error({ err }, 'Error handling Feishu message event');
    }
  }

  async sendMessage(jid: string, text: string): Promise<void> {
    if (!this.client) {
      logger.warn('Feishu client not initialized');
      return;
    }

    try {
      const chatId = jid.replace(/^feishu:/, '');

      // Feishu has a message size limit; split long messages if needed
      const MAX_LENGTH = 4000;
      const chunks =
        text.length <= MAX_LENGTH
          ? [text]
          : text.match(new RegExp(`.{1,${MAX_LENGTH}}`, 'gs')) || [text];

      for (const chunk of chunks) {
        await this.client.im.message.create({
          params: {
            receive_id_type: 'chat_id',
          },
          data: {
            receive_id: chatId,
            content: JSON.stringify({ text: chunk }),
            msg_type: 'text',
          },
        });
      }

      logger.info({ jid, length: text.length }, 'Feishu message sent');
    } catch (err) {
      logger.error({ jid, err }, 'Failed to send Feishu message');
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  ownsJid(jid: string): boolean {
    return jid.startsWith('feishu:');
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    // WSClient doesn't expose a stop method in all versions,
    // but we mark as disconnected
    this.wsClient = null;
    this.client = null;
    logger.info('Feishu bot stopped');
  }

  async setTyping(_jid: string, _isTyping: boolean): Promise<void> {
    // Feishu doesn't have a public typing indicator API
    // This is a no-op but satisfies the Channel interface
  }
}
