# Postie

A TypeScript package for sending messages via Telegram and other platforms.

## Installation

```bash
npm install postie
```

## Usage

### Telegram Messages

```typescript
import { createPostie } from 'postie';

// Initialize Postie with Telegram config
const postie = createPostie({
  telegram: {
    botToken: 'your-telegram-bot-token',
    chatId: 'your-chat-id'
  }
});

// Send a simple message
await postie.telegram.sendMessage('Hello from Postie!');

// Send a message with Markdown formatting
await postie.telegram.sendMarkdownMessage('**Bold** and _italic_ text');
```

### Direct Telegram Messenger

You can also use the Telegram messenger directly:

```typescript
import { TelegramMessenger } from 'postie';

const telegram = new TelegramMessenger({
  botToken: 'your-telegram-bot-token',
  chatId: 'your-chat-id'
});

await telegram.sendMessage('Hello!');
```

## Configuration

### Telegram

To use Telegram messaging, you need:
1. A Telegram bot token (create a bot via [@BotFather](https://t.me/botfather))
2. A chat ID (the ID of the chat where messages will be sent)

## Future Plans

- Email support
- Slack integration
- Additional messaging platforms
