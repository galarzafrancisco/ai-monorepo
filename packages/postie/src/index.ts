// Export Telegram messenger
export { TelegramMessenger, TelegramConfig } from './telegram';

// Main Postie interface for future expansion
export interface PostieConfig {
  telegram?: {
    botToken: string;
    chatId: string;
  };
  // Future: email, slack, etc.
}

/**
 * Postie - A unified messaging library for Telegram, Email, and more
 *
 * Currently supports:
 * - Telegram messages
 *
 * Future support planned:
 * - Email
 * - Slack
 * - Other messaging platforms
 */
export class Postie {
  private telegramMessenger?: TelegramMessenger;

  constructor(config: PostieConfig) {
    if (config.telegram) {
      this.telegramMessenger = new TelegramMessenger(config.telegram);
    }
  }

  /**
   * Get the Telegram messenger instance
   * @throws Error if Telegram is not configured
   */
  get telegram() {
    if (!this.telegramMessenger) {
      throw new Error('Telegram is not configured. Please provide telegram config in PostieConfig');
    }
    return this.telegramMessenger;
  }
}

// Convenience export for creating a Postie instance
export function createPostie(config: PostieConfig): Postie {
  return new Postie(config);
}
