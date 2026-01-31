import TelegramBot from 'node-telegram-bot-api';

export interface TelegramConfig {
  botToken: string;
  chatId: string;
}

export class TelegramMessenger {
  private bot: TelegramBot;
  private chatId: string;

  constructor(config: TelegramConfig) {
    if (!config.botToken) {
      throw new Error('Telegram bot token is required');
    }
    if (!config.chatId) {
      throw new Error('Telegram chat ID is required');
    }

    this.bot = new TelegramBot(config.botToken, { polling: false });
    this.chatId = config.chatId;
  }

  /**
   * Send a text message via Telegram
   * @param message - The message text to send
   * @returns Promise with the sent message details
   */
  async sendMessage(message: string): Promise<TelegramBot.Message> {
    try {
      return await this.bot.sendMessage(this.chatId, message);
    } catch (error) {
      throw new Error(`Failed to send Telegram message: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Send a message with markdown formatting
   * @param message - The message text with markdown formatting
   * @returns Promise with the sent message details
   */
  async sendMarkdownMessage(message: string): Promise<TelegramBot.Message> {
    try {
      return await this.bot.sendMessage(this.chatId, message, { parse_mode: 'Markdown' });
    } catch (error) {
      throw new Error(`Failed to send Telegram markdown message: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
