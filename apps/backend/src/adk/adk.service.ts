import { Injectable, Logger } from '@nestjs/common';
import { getAdkBaseUrl } from './adk.config';
import {
  ChatEvent,
  CreateSessionResponse,
  GetSessionResponse,
  ListAppsResponse,
  ListSessionsResponse,
  SendMessageRequest,
  SendMessageResponse,
} from './dto/adk.types';

/**
 * ADK Client Service
 *
 * Provides a client for interacting with the ADK (Agent Development Kit) API.
 * Handles session management and message sending to ADK agents.
 */
@Injectable()
export class AdkService {
  private readonly logger = new Logger(AdkService.name);
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = getAdkBaseUrl();
    this.logger.log(`ADK Service initialized with base URL: ${this.baseUrl}`);
  }

  /**
   * Build a full URL from a path
   */
  private buildUrl(path: string): string {
    const base = this.baseUrl.replace(/\/$/, '');
    return `${base}${path}`;
  }

  /**
   * List all available apps
   */
  async listApps(): Promise<ListAppsResponse> {
    this.logger.log('Listing ADK apps');
    const url = this.buildUrl('/list-apps');

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to list apps: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Create a new session for an app and user
   *
   * @param appId - The app identifier
   * @param userId - The user identifier
   * @param sessionId - Optional session ID (will be generated if not provided)
   */
  async createSession(
    appId: string,
    userId: string,
    sessionId?: string,
  ): Promise<CreateSessionResponse> {
    this.logger.log(
      `Creating session for app: ${appId}, user: ${userId}${sessionId ? `, session: ${sessionId}` : ''}`,
    );

    const endpoint = sessionId
      ? this.buildUrl(
          `/apps/${encodeURIComponent(appId)}/users/${encodeURIComponent(userId)}/sessions/${encodeURIComponent(sessionId)}`,
        )
      : this.buildUrl(
          `/apps/${encodeURIComponent(appId)}/users/${encodeURIComponent(userId)}/sessions`,
        );

    const response = await fetch(endpoint, { method: 'POST' });
    if (!response.ok) {
      throw new Error(`Failed to create session: ${response.status}`);
    }

    return response.json();
  }

  /**
   * List all sessions for an app and user
   *
   * @param appId - The app identifier
   * @param userId - The user identifier
   */
  async listSessions(
    appId: string,
    userId: string,
  ): Promise<ListSessionsResponse> {
    this.logger.log(`Listing sessions for app: ${appId}, user: ${userId}`);

    const url = this.buildUrl(
      `/apps/${encodeURIComponent(appId)}/users/${encodeURIComponent(userId)}/sessions`,
    );

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to list sessions: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Get a specific session
   *
   * @param appId - The app identifier
   * @param userId - The user identifier
   * @param sessionId - The session identifier
   */
  async getSession(
    appId: string,
    userId: string,
    sessionId: string,
  ): Promise<GetSessionResponse> {
    this.logger.log(
      `Getting session for app: ${appId}, user: ${userId}, session: ${sessionId}`,
    );

    const url = this.buildUrl(
      `/apps/${encodeURIComponent(appId)}/users/${encodeURIComponent(userId)}/sessions/${encodeURIComponent(sessionId)}`,
    );

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to get session: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Send a message to an agent (non-streaming)
   *
   * @param payload - The message request payload
   */
  async run(payload: SendMessageRequest): Promise<SendMessageResponse> {
    this.logger.log(
      `Sending message to app: ${payload.app_name}, session: ${payload.session_id}`,
    );

    const url = this.buildUrl('/run');
    const requestPayload = { ...payload, streaming: false };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestPayload),
    });

    if (!response.ok) {
      throw new Error(`Failed to send message: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Send a message to an agent with Server-Sent Events (SSE) streaming
   *
   * This returns an async generator that yields chat events as they arrive
   *
   * @param payload - The message request payload
   */
  async *runSSE(payload: SendMessageRequest): AsyncGenerator<ChatEvent> {
    this.logger.log(
      `Sending streaming message to app: ${payload.app_name}, session: ${payload.session_id}`,
    );

    const url = this.buildUrl('/run_sse');
    const requestPayload = { ...payload, streaming: true };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(requestPayload),
    });

    if (!response.ok) {
      throw new Error(`Failed to start streaming: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();

          if (!trimmedLine || trimmedLine.startsWith(':')) {
            continue;
          }

          if (trimmedLine.startsWith('data:')) {
            const data = trimmedLine.slice(5).trim();

            if (data === '[DONE]') {
              return;
            }

            try {
              const event = JSON.parse(data) as ChatEvent;
              yield event;
            } catch (e) {
              this.logger.warn(`Failed to parse SSE event: ${data}`, e);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
