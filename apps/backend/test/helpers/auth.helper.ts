import request from 'supertest';
import { App } from 'supertest/types';
import { INestApplication } from '@nestjs/common';
import { IdentityProviderService } from '../../src/identity-provider/identity-provider.service';

export const TEST_USER_EMAIL = 'test@example.com';
export const TEST_USER_PASSWORD = 'testpassword';
export const TEST_USER_DISPLAY_NAME = 'Test User';

/**
 * Creates a test user if it doesn't exist
 */
export async function ensureTestUser(app: INestApplication): Promise<void> {
  const identityService = app.get(IdentityProviderService);

  try {
    await identityService.getUserByEmail(TEST_USER_EMAIL);
  } catch (error) {
    // User doesn't exist, create it
    await identityService.createUser(
      TEST_USER_EMAIL,
      TEST_USER_DISPLAY_NAME,
      TEST_USER_PASSWORD,
    );
  }
}

/**
 * Logs in and returns authentication cookies
 */
export async function getAuthCookies(httpServer: App): Promise<string[]> {
  const response = await request(httpServer)
    .post('/api/v1/auth/login')
    .send({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
    })
    .expect(200);

  return response.headers['set-cookie'] || [];
}

/**
 * Creates an authenticated request with cookies
 */
export function authenticatedRequest(httpServer: App, cookies: string[]) {
  return {
    get: (url: string) => request(httpServer).get(url).set('Cookie', cookies),
    post: (url: string) => request(httpServer).post(url).set('Cookie', cookies),
    patch: (url: string) => request(httpServer).patch(url).set('Cookie', cookies),
    delete: (url: string) => request(httpServer).delete(url).set('Cookie', cookies),
  };
}
