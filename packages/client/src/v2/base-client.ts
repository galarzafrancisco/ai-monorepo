// Base client with fetch wrapper
export interface ClientConfig {
  baseUrl: string;
  /** Bearer token auth: sets Authorization: Bearer <token> */
  getAccessToken?: () => string | Promise<string>;
  /** Cookie auth for Node.js: sets Cookie header directly */
  getCookies?: () => string | Promise<string>;
  /** Cookie auth for browsers: passed as fetch credentials option (e.g. 'include') */
  credentials?: 'include' | 'same-origin' | 'omit';
  headers?: Record<string, string>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getErrorMessageFromBody(body: unknown): string | undefined {
  if (!isRecord(body)) {
    return undefined;
  }

  const detail = body.detail;
  if (typeof detail === 'string' && detail.length > 0) {
    return detail;
  }

  const message = body.message;
  if (typeof message === 'string' && message.length > 0) {
    return message;
  }

  const title = body.title;
  if (typeof title === 'string' && title.length > 0) {
    return title;
  }

  const errorDescription = body.error_description;
  if (typeof errorDescription === 'string' && errorDescription.length > 0) {
    return errorDescription;
  }

  return undefined;
}

export class ApiError extends Error {
  public readonly status: number;
  public readonly statusText: string;
  public readonly body: unknown;

  constructor(response: Response, body: unknown) {
    const message = getErrorMessageFromBody(body) ?? `HTTP ${response.status}: ${response.statusText}`;
    super(message);
    this.name = 'ApiError';
    this.status = response.status;
    this.statusText = response.statusText;
    this.body = body;
  }
}

export class BaseClient {
  constructor(protected config: ClientConfig) {}

  private async parseResponseBody(response: Response): Promise<unknown> {
    if (response.status === 204 || response.headers.get('content-length') === '0') {
      return undefined;
    }

    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      try {
        return await response.json();
      } catch {
        return undefined;
      }
    }

    const text = await response.text();
    return text.length > 0 ? text : undefined;
  }

  private async buildAuthHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {};
    if (this.config.getAccessToken) {
      const token = await this.config.getAccessToken();
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (this.config.getCookies) {
      headers['Cookie'] = await this.config.getCookies();
    }
    return headers;
  }

  protected async request<T>(
    method: string,
    path: string,
    options?: {
      params?: Record<string, any>;
      body?: any;
      headers?: Record<string, string>;
      signal?: AbortSignal;
    }
  ): Promise<T> {
    const url = new URL(path, this.config.baseUrl);

    // Add query parameters
    if (options?.params) {
      for (const [key, value] of Object.entries(options.params)) {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      }
    }

    // Build headers (filter out undefined values)
    const headers: Record<string, string> = {};

    // Add config headers
    if (this.config.headers) {
      for (const [key, value] of Object.entries(this.config.headers)) {
        if (value !== undefined && value !== null) {
          headers[key] = String(value);
        }
      }
    }

    // Add request-specific headers
    if (options?.headers) {
      for (const [key, value] of Object.entries(options.headers)) {
        if (value !== undefined && value !== null) {
          headers[key] = String(value);
        }
      }
    }

    // Add auth headers
    Object.assign(headers, await this.buildAuthHeaders());

    // Add content type for body requests
    if (options?.body && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url.toString(), {
      method,
      headers,
      body: options?.body ? JSON.stringify(options.body) : undefined,
      signal: options?.signal,
      credentials: this.config.credentials,
    });

    if (!response.ok) {
      const errorBody = await this.parseResponseBody(response);
      throw new ApiError(response, errorBody);
    }

    return await this.parseResponseBody(response) as T;
  }

  protected async *streamEvents<T = any>(
    path: string,
    options?: {
      params?: Record<string, any>;
      headers?: Record<string, string>;
      signal?: AbortSignal;
    }
  ): AsyncIterable<T> {
    const url = new URL(path, this.config.baseUrl);

    if (options?.params) {
      for (const [key, value] of Object.entries(options.params)) {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      }
    }

    // Build headers (filter out undefined values)
    const headers: Record<string, string> = {
      'Accept': 'text/event-stream',
    };

    // Add config headers
    if (this.config.headers) {
      for (const [key, value] of Object.entries(this.config.headers)) {
        if (value !== undefined && value !== null) {
          headers[key] = String(value);
        }
      }
    }

    // Add request-specific headers
    if (options?.headers) {
      for (const [key, value] of Object.entries(options.headers)) {
        if (value !== undefined && value !== null) {
          headers[key] = String(value);
        }
      }
    }

    // Add auth headers
    Object.assign(headers, await this.buildAuthHeaders());

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers,
      signal: options?.signal,
      credentials: this.config.credentials,
    });

    if (!response.ok) {
      const errorBody = await this.parseResponseBody(response);
      throw new ApiError(response, errorBody);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            try {
              yield JSON.parse(data) as T;
            } catch {
              yield data as T;
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
