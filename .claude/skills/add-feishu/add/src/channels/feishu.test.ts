import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// --- Mocks ---

// Mock config
vi.mock('../config.js', () => ({
  ASSISTANT_NAME: 'Andy',
  TRIGGER_PATTERN: /^@Andy\b/i,
}));

// Mock logger
vi.mock('../logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// --- Lark SDK mock ---

type Handler = (...args: any[]) => any;

const clientRef = vi.hoisted(() => ({
  current: null as any,
  wsClient: null as any,
  eventHandler: null as any,
}));

vi.mock('@larksuiteoapi/node-sdk', () => {
  const mockSendMessage = vi.fn().mockResolvedValue({ code: 0 });

  return {
    Client: class MockClient {
      im = {
        message: {
          create: mockSendMessage,
        },
      };
      bot = {
        v3: {
          botInfo: {
            get: vi.fn().mockResolvedValue({
              data: {
                bot: {
                  app_name: 'TestBot',
                  open_id: 'ou_bot_123',
                },
              },
            }),
          },
        },
      };

      constructor(_config: any) {
        clientRef.current = this;
      }
    },
    WSClient: class MockWSClient {
      constructor(_config: any) {
        clientRef.wsClient = this;
      }
      start(opts: { eventDispatcher: any }) {
        clientRef.eventHandler = opts.eventDispatcher;
      }
    },
    EventDispatcher: class MockEventDispatcher {
      handlers: Record<string, Handler> = {};
      constructor(_config?: any) {}
      register(handlers: Record<string, Handler>) {
        this.handlers = { ...this.handlers, ...handlers };
        return this;
      }
    },
    AppType: { SelfBuild: 0, ISV: 1 },
    Domain: { Feishu: 'https://open.feishu.cn', Lark: 'https://open.larksuite.com' },
    LoggerLevel: { info: 'info', debug: 'debug', warn: 'warn', error: 'error' },
  };
});

import { FeishuChannel, FeishuChannelOpts } from './feishu.js';

// --- Test helpers ---

function createTestOpts(
  overrides?: Partial<FeishuChannelOpts>,
): FeishuChannelOpts {
  return {
    onMessage: vi.fn(),
    onChatMetadata: vi.fn(),
    registeredGroups: vi.fn(() => ({
      'feishu:oc_test_chat_123': {
        name: 'Test Group',
        folder: 'test-group',
        trigger: '@Andy',
        added_at: '2024-01-01T00:00:00.000Z',
      },
    })),
    ...overrides,
  };
}

function createMessageEvent(overrides: {
  chatId?: string;
  chatType?: string;
  text?: string;
  messageType?: string;
  senderOpenId?: string;
  senderType?: string;
  messageId?: string;
  createTime?: string;
  mentions?: any[];
  content?: string;
}) {
  const chatId = overrides.chatId ?? 'oc_test_chat_123';
  const chatType = overrides.chatType ?? 'group';
  const messageType = overrides.messageType ?? 'text';
  const text = overrides.text ?? 'Hello everyone';
  const content =
    overrides.content ??
    (messageType === 'text' ? JSON.stringify({ text }) : '');

  return {
    message: {
      chat_id: chatId,
      chat_type: chatType,
      message_id: overrides.messageId ?? 'msg_001',
      message_type: messageType,
      content,
      create_time: overrides.createTime ?? Date.now().toString(),
      mentions: overrides.mentions,
    },
    sender: {
      sender_id: {
        open_id: overrides.senderOpenId ?? 'ou_user_456',
      },
      sender_type: overrides.senderType ?? 'user',
    },
  };
}

async function triggerMessageEvent(data: any) {
  const dispatcher = clientRef.eventHandler;
  if (dispatcher && dispatcher.handlers['im.message.receive_v1']) {
    await dispatcher.handlers['im.message.receive_v1'](data);
  }
}

// --- Tests ---

describe('FeishuChannel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // --- Connection lifecycle ---

  describe('connection lifecycle', () => {
    it('resolves connect() and marks as connected', async () => {
      const opts = createTestOpts();
      const channel = new FeishuChannel('app_id', 'app_secret', opts);

      const connectPromise = channel.connect();
      vi.advanceTimersByTime(3000);
      await connectPromise;

      expect(channel.isConnected()).toBe(true);
    });

    it('isConnected() returns false before connect', () => {
      const opts = createTestOpts();
      const channel = new FeishuChannel('app_id', 'app_secret', opts);

      expect(channel.isConnected()).toBe(false);
    });

    it('disconnects cleanly', async () => {
      const opts = createTestOpts();
      const channel = new FeishuChannel('app_id', 'app_secret', opts);

      const connectPromise = channel.connect();
      vi.advanceTimersByTime(3000);
      await connectPromise;
      expect(channel.isConnected()).toBe(true);

      await channel.disconnect();
      expect(channel.isConnected()).toBe(false);
    });

    it('fetches bot info on connect', async () => {
      const opts = createTestOpts();
      const channel = new FeishuChannel('app_id', 'app_secret', opts);

      const connectPromise = channel.connect();
      vi.advanceTimersByTime(3000);
      await connectPromise;

      expect(clientRef.current.bot.v3.botInfo.get).toHaveBeenCalled();
    });
  });

  // --- Text message handling ---

  describe('text message handling', () => {
    it('delivers message for registered group', async () => {
      const opts = createTestOpts();
      const channel = new FeishuChannel('app_id', 'app_secret', opts);

      const connectPromise = channel.connect();
      vi.advanceTimersByTime(3000);
      await connectPromise;

      const event = createMessageEvent({ text: 'Hello everyone' });
      await triggerMessageEvent(event);

      expect(opts.onChatMetadata).toHaveBeenCalledWith(
        'feishu:oc_test_chat_123',
        expect.any(String),
        expect.any(String),
        'feishu',
        true,
      );
      expect(opts.onMessage).toHaveBeenCalledWith(
        'feishu:oc_test_chat_123',
        expect.objectContaining({
          id: 'msg_001',
          chat_jid: 'feishu:oc_test_chat_123',
          sender: 'ou_user_456',
          content: 'Hello everyone',
          is_from_me: false,
        }),
      );
    });

    it('only emits metadata for unregistered chats', async () => {
      const opts = createTestOpts();
      const channel = new FeishuChannel('app_id', 'app_secret', opts);

      const connectPromise = channel.connect();
      vi.advanceTimersByTime(3000);
      await connectPromise;

      const event = createMessageEvent({
        chatId: 'oc_unknown_999',
        text: 'Unknown chat',
      });
      await triggerMessageEvent(event);

      expect(opts.onChatMetadata).toHaveBeenCalledWith(
        'feishu:oc_unknown_999',
        expect.any(String),
        expect.any(String),
        'feishu',
        true,
      );
      expect(opts.onMessage).not.toHaveBeenCalled();
    });

    it('skips messages from bots', async () => {
      const opts = createTestOpts();
      const channel = new FeishuChannel('app_id', 'app_secret', opts);

      const connectPromise = channel.connect();
      vi.advanceTimersByTime(3000);
      await connectPromise;

      const event = createMessageEvent({
        text: 'Bot message',
        senderType: 'bot',
      });
      await triggerMessageEvent(event);

      expect(opts.onMessage).not.toHaveBeenCalled();
      expect(opts.onChatMetadata).not.toHaveBeenCalled();
    });

    it('handles /chatid command', async () => {
      const opts = createTestOpts();
      const channel = new FeishuChannel('app_id', 'app_secret', opts);

      const connectPromise = channel.connect();
      vi.advanceTimersByTime(3000);
      await connectPromise;

      const event = createMessageEvent({ text: '/chatid' });
      await triggerMessageEvent(event);

      expect(clientRef.current.im.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            receive_id: 'oc_test_chat_123',
            msg_type: 'text',
          }),
        }),
      );
      // Should not deliver as a regular message
      expect(opts.onMessage).not.toHaveBeenCalled();
    });

    it('handles /ping command', async () => {
      const opts = createTestOpts();
      const channel = new FeishuChannel('app_id', 'app_secret', opts);

      const connectPromise = channel.connect();
      vi.advanceTimersByTime(3000);
      await connectPromise;

      const event = createMessageEvent({ text: '/ping' });
      await triggerMessageEvent(event);

      expect(clientRef.current.im.message.create).toHaveBeenCalled();
      expect(opts.onMessage).not.toHaveBeenCalled();
    });

    it('handles private chat messages', async () => {
      const opts = createTestOpts({
        registeredGroups: vi.fn(() => ({
          'feishu:oc_private_001': {
            name: 'Private Chat',
            folder: 'private',
            trigger: '@Andy',
            added_at: '2024-01-01T00:00:00.000Z',
          },
        })),
      });
      const channel = new FeishuChannel('app_id', 'app_secret', opts);

      const connectPromise = channel.connect();
      vi.advanceTimersByTime(3000);
      await connectPromise;

      const event = createMessageEvent({
        chatId: 'oc_private_001',
        chatType: 'p2p',
        text: 'Hello',
      });
      await triggerMessageEvent(event);

      expect(opts.onChatMetadata).toHaveBeenCalledWith(
        'feishu:oc_private_001',
        expect.any(String),
        expect.any(String),
        'feishu',
        false,
      );
      expect(opts.onMessage).toHaveBeenCalledWith(
        'feishu:oc_private_001',
        expect.objectContaining({
          chat_jid: 'feishu:oc_private_001',
          content: 'Hello',
        }),
      );
    });
  });

  // --- @mention trigger handling ---

  describe('@mention trigger handling', () => {
    it('prepends trigger when bot is @mentioned in group', async () => {
      const opts = createTestOpts();
      const channel = new FeishuChannel('app_id', 'app_secret', opts);

      const connectPromise = channel.connect();
      vi.advanceTimersByTime(3000);
      await connectPromise;

      const event = createMessageEvent({
        text: '@_user_1 help me with this',
        mentions: [
          {
            key: '@_user_1',
            id: { open_id: 'ou_bot_123' },
            name: 'TestBot',
          },
        ],
      });
      // Override content to include the mention key
      event.message.content = JSON.stringify({
        text: '@_user_1 help me with this',
      });
      await triggerMessageEvent(event);

      expect(opts.onMessage).toHaveBeenCalledWith(
        'feishu:oc_test_chat_123',
        expect.objectContaining({
          content: expect.stringContaining('@Andy'),
        }),
      );
    });

    it('does not prepend trigger when bot is not mentioned', async () => {
      const opts = createTestOpts();
      const channel = new FeishuChannel('app_id', 'app_secret', opts);

      const connectPromise = channel.connect();
      vi.advanceTimersByTime(3000);
      await connectPromise;

      const event = createMessageEvent({ text: 'Just a regular message' });
      await triggerMessageEvent(event);

      expect(opts.onMessage).toHaveBeenCalledWith(
        'feishu:oc_test_chat_123',
        expect.objectContaining({
          content: 'Just a regular message',
        }),
      );
    });
  });

  // --- Non-text message handling ---

  describe('non-text message handling', () => {
    it('handles image messages with placeholder', async () => {
      const opts = createTestOpts();
      const channel = new FeishuChannel('app_id', 'app_secret', opts);

      const connectPromise = channel.connect();
      vi.advanceTimersByTime(3000);
      await connectPromise;

      const event = createMessageEvent({
        messageType: 'image',
        content: JSON.stringify({ image_key: 'img_xxx' }),
      });
      await triggerMessageEvent(event);

      expect(opts.onMessage).toHaveBeenCalledWith(
        'feishu:oc_test_chat_123',
        expect.objectContaining({
          content: '[Image]',
        }),
      );
    });

    it('handles audio messages with placeholder', async () => {
      const opts = createTestOpts();
      const channel = new FeishuChannel('app_id', 'app_secret', opts);

      const connectPromise = channel.connect();
      vi.advanceTimersByTime(3000);
      await connectPromise;

      const event = createMessageEvent({
        messageType: 'audio',
        content: '{}',
      });
      await triggerMessageEvent(event);

      expect(opts.onMessage).toHaveBeenCalledWith(
        'feishu:oc_test_chat_123',
        expect.objectContaining({
          content: '[Audio]',
        }),
      );
    });

    it('handles file messages with placeholder', async () => {
      const opts = createTestOpts();
      const channel = new FeishuChannel('app_id', 'app_secret', opts);

      const connectPromise = channel.connect();
      vi.advanceTimersByTime(3000);
      await connectPromise;

      const event = createMessageEvent({
        messageType: 'file',
        content: '{}',
      });
      await triggerMessageEvent(event);

      expect(opts.onMessage).toHaveBeenCalledWith(
        'feishu:oc_test_chat_123',
        expect.objectContaining({
          content: '[File]',
        }),
      );
    });

    it('handles post (rich text) messages with placeholder', async () => {
      const opts = createTestOpts();
      const channel = new FeishuChannel('app_id', 'app_secret', opts);

      const connectPromise = channel.connect();
      vi.advanceTimersByTime(3000);
      await connectPromise;

      const event = createMessageEvent({
        messageType: 'post',
        content: '{}',
      });
      await triggerMessageEvent(event);

      expect(opts.onMessage).toHaveBeenCalledWith(
        'feishu:oc_test_chat_123',
        expect.objectContaining({
          content: '[Rich Text]',
        }),
      );
    });

    it('handles unknown message types with generic placeholder', async () => {
      const opts = createTestOpts();
      const channel = new FeishuChannel('app_id', 'app_secret', opts);

      const connectPromise = channel.connect();
      vi.advanceTimersByTime(3000);
      await connectPromise;

      const event = createMessageEvent({
        messageType: 'custom_type',
        content: '{}',
      });
      await triggerMessageEvent(event);

      expect(opts.onMessage).toHaveBeenCalledWith(
        'feishu:oc_test_chat_123',
        expect.objectContaining({
          content: '[custom_type]',
        }),
      );
    });
  });

  // --- Send message ---

  describe('sendMessage', () => {
    it('sends text message via Feishu API', async () => {
      const opts = createTestOpts();
      const channel = new FeishuChannel('app_id', 'app_secret', opts);

      const connectPromise = channel.connect();
      vi.advanceTimersByTime(3000);
      await connectPromise;

      await channel.sendMessage('feishu:oc_test_chat_123', 'Hello from bot');

      expect(clientRef.current.im.message.create).toHaveBeenCalledWith({
        params: { receive_id_type: 'chat_id' },
        data: {
          receive_id: 'oc_test_chat_123',
          content: JSON.stringify({ text: 'Hello from bot' }),
          msg_type: 'text',
        },
      });
    });

    it('splits long messages', async () => {
      const opts = createTestOpts();
      const channel = new FeishuChannel('app_id', 'app_secret', opts);

      const connectPromise = channel.connect();
      vi.advanceTimersByTime(3000);
      await connectPromise;

      const longText = 'A'.repeat(5000);
      await channel.sendMessage('feishu:oc_test_chat_123', longText);

      // Should be called twice (4000 + 1000)
      expect(clientRef.current.im.message.create).toHaveBeenCalledTimes(2);
    });

    it('handles send failure gracefully', async () => {
      const opts = createTestOpts();
      const channel = new FeishuChannel('app_id', 'app_secret', opts);

      const connectPromise = channel.connect();
      vi.advanceTimersByTime(3000);
      await connectPromise;

      clientRef.current.im.message.create.mockRejectedValueOnce(
        new Error('API error'),
      );

      // Should not throw
      await expect(
        channel.sendMessage('feishu:oc_test_chat_123', 'test'),
      ).resolves.not.toThrow();
    });

    it('warns when client not initialized', async () => {
      const opts = createTestOpts();
      const channel = new FeishuChannel('app_id', 'app_secret', opts);

      // Don't connect — client is null
      await channel.sendMessage('feishu:oc_test_chat_123', 'test');

      // Should not throw, just log warning
    });
  });

  // --- JID ownership ---

  describe('ownsJid', () => {
    it('returns true for feishu: prefixed JIDs', () => {
      const opts = createTestOpts();
      const channel = new FeishuChannel('app_id', 'app_secret', opts);

      expect(channel.ownsJid('feishu:oc_123')).toBe(true);
    });

    it('returns false for non-feishu JIDs', () => {
      const opts = createTestOpts();
      const channel = new FeishuChannel('app_id', 'app_secret', opts);

      expect(channel.ownsJid('tg:123')).toBe(false);
      expect(channel.ownsJid('123@s.whatsapp.net')).toBe(false);
    });
  });

  // --- setTyping ---

  describe('setTyping', () => {
    it('is a no-op that does not throw', async () => {
      const opts = createTestOpts();
      const channel = new FeishuChannel('app_id', 'app_secret', opts);

      const connectPromise = channel.connect();
      vi.advanceTimersByTime(3000);
      await connectPromise;

      await expect(
        channel.setTyping('feishu:oc_test_chat_123', true),
      ).resolves.not.toThrow();
    });
  });

  // --- Error handling ---

  describe('error handling', () => {
    it('handles malformed message content gracefully', async () => {
      const opts = createTestOpts();
      const channel = new FeishuChannel('app_id', 'app_secret', opts);

      const connectPromise = channel.connect();
      vi.advanceTimersByTime(3000);
      await connectPromise;

      const event = createMessageEvent({
        text: '',
        content: 'not-json',
      });
      await triggerMessageEvent(event);

      // Should handle gracefully — content falls back to raw string
      expect(opts.onMessage).toHaveBeenCalledWith(
        'feishu:oc_test_chat_123',
        expect.objectContaining({
          content: 'not-json',
        }),
      );
    });

    it('handles missing message data gracefully', async () => {
      const opts = createTestOpts();
      const channel = new FeishuChannel('app_id', 'app_secret', opts);

      const connectPromise = channel.connect();
      vi.advanceTimersByTime(3000);
      await connectPromise;

      // Event with no message
      await triggerMessageEvent({});

      expect(opts.onMessage).not.toHaveBeenCalled();
    });
  });
});
