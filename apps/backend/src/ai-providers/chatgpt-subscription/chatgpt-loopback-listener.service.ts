import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import {
  createServer,
  IncomingMessage,
  Server,
  ServerResponse,
} from 'node:http';
import { AddressInfo } from 'node:net';
import {
  getChatgptSubscriptionCallbackPort,
  getConfig,
} from 'src/config/env.config';
import {
  LOOPBACK_CALLBACK_PATH,
  LOOPBACK_HOST,
  UI_CALLBACK_PATH,
} from './chatgpt-subscription.constants';

/**
 * Receives the Sign in with ChatGPT redirect on 127.0.0.1, which is the only
 * redirect OpenAI allows for this kind of client.
 *
 * It finishes nothing itself. It sends the browser on to the Taico UI with the
 * same query string, and the UI posts it to the API as the signed-in user. So a
 * sign-in can only be finished by the Taico user who started it.
 *
 * The listener is open only while a sign-in is in progress.
 */
@Injectable()
export class ChatgptLoopbackListenerService implements OnModuleDestroy {
  private readonly logger = new Logger(ChatgptLoopbackListenerService.name);
  private server: Server | null = null;
  private starting: Promise<number> | null = null;
  /** State values this process is waiting for, with the timer that forgets each. */
  private readonly expected = new Map<string, NodeJS.Timeout>();

  /** Opens the listener if needed and returns the redirect URI to send to OpenAI. */
  async expect(state: string, ttlMs: number): Promise<string> {
    const port = await this.ensureListening();

    const timer = setTimeout(() => this.forget(state), ttlMs);
    timer.unref();
    this.expected.set(state, timer);

    return `http://${LOOPBACK_HOST}:${port}${LOOPBACK_CALLBACK_PATH}`;
  }

  forget(state: string): void {
    const timer = this.expected.get(state);
    if (timer) {
      clearTimeout(timer);
      this.expected.delete(state);
    }
    if (this.expected.size === 0) {
      this.close();
    }
  }

  onModuleDestroy(): void {
    for (const timer of this.expected.values()) {
      clearTimeout(timer);
    }
    this.expected.clear();
    this.close();
  }

  private ensureListening(): Promise<number> {
    if (this.server?.listening) {
      return Promise.resolve((this.server.address() as AddressInfo).port);
    }
    if (!this.starting) {
      this.starting = new Promise<number>((resolve, reject) => {
        const server = createServer((req, res) => this.handle(req, res));
        server.once('error', reject);
        server.listen(
          getChatgptSubscriptionCallbackPort(),
          LOOPBACK_HOST,
          () => {
            server.off('error', reject);
            server.unref();
            this.server = server;
            resolve((server.address() as AddressInfo).port);
          },
        );
      }).finally(() => {
        this.starting = null;
      });
    }
    return this.starting;
  }

  private close(): void {
    this.server?.close();
    this.server = null;
  }

  private handle(req: IncomingMessage, res: ServerResponse): void {
    const url = new URL(req.url ?? '/', `http://${LOOPBACK_HOST}`);
    const state = url.searchParams.get('state');

    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');

    if (
      req.method !== 'GET' ||
      url.pathname !== LOOPBACK_CALLBACK_PATH ||
      !state ||
      !this.expected.has(state)
    ) {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(
        'This sign-in is not in progress. Start again from Taico settings.',
      );
      return;
    }

    this.forget(state);
    this.logger.log({ message: 'Received Sign in with ChatGPT redirect' });

    const target = new URL(UI_CALLBACK_PATH, getConfig().issuerUrl);
    target.search = url.search;
    res.writeHead(302, { Location: target.toString() });
    res.end();
  }
}
