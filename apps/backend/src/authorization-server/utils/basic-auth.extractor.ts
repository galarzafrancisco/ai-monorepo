import type { IncomingHttpHeaders } from 'http';

export interface BasicAuthCredentials {
  clientId: string;
  clientSecret: string;
}

/**
 * Extracts Basic Auth credentials from HTTP headers.
 * Parses the Authorization header in format: Basic base64(client_id:client_secret)
 * URL-decodes credentials per RFC 6749 section 2.3.1.
 *
 * @param headers - HTTP request headers
 * @returns Extracted credentials or null if not present/invalid
 */
export function extractBasicAuth(
  headers: IncomingHttpHeaders,
): BasicAuthCredentials | null {
  const authHeader = headers.authorization;

  if (!authHeader) {
    return null;
  }

  // Check for Basic auth scheme (case-insensitive)
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'basic') {
    return null;
  }

  const base64Credentials = parts[1];

  try {
    // Decode base64
    const decoded = Buffer.from(base64Credentials, 'base64').toString('utf-8');

    // Split on first colon (password may contain colons)
    const colonIndex = decoded.indexOf(':');
    if (colonIndex === -1) {
      return null;
    }

    const clientId = decoded.substring(0, colonIndex);
    const clientSecret = decoded.substring(colonIndex + 1);

    // URL-decode per RFC 6749 section 2.3.1
    return {
      clientId: decodeURIComponent(clientId),
      clientSecret: decodeURIComponent(clientSecret),
    };
  } catch {
    // Invalid base64 or URL encoding
    return null;
  }
}
