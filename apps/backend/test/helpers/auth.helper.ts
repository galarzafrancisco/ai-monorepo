import request from 'supertest';
import { App } from 'supertest/types';
import { INestApplication } from '@nestjs/common';
import { IdentityProviderService } from '../../src/identity-provider/identity-provider.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../../src/identity-provider/user.entity';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';

export const TEST_USER_EMAIL = 'test@example.com';
export const TEST_USER_PASSWORD = 'testpassword';
export const TEST_USER_DISPLAY_NAME = 'Test User';

/**
 * Creates a test user if it doesn't exist, or updates password if it exists
 */
export async function ensureTestUser(app: INestApplication): Promise<void> {
  const identityService = app.get(IdentityProviderService);
  const userRepository = app.get<Repository<User>>(getRepositoryToken(User));

  // Check if test user exists
  const existingUser = await userRepository.findOne({
    where: { email: TEST_USER_EMAIL },
  });

  if (existingUser) {
    // Update password hash to ensure it matches TEST_USER_PASSWORD
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(TEST_USER_PASSWORD, saltRounds);
    existingUser.passwordHash = passwordHash;
    existingUser.displayName = TEST_USER_DISPLAY_NAME;
    await userRepository.save(existingUser);
  } else {
    // Create fresh test user
    await identityService.createUser(
      TEST_USER_EMAIL,
      TEST_USER_DISPLAY_NAME,
      TEST_USER_PASSWORD,
    );
  }
}

/**
 * Logs in and returns authentication cookies as a single string
 */
export async function getAuthCookies(httpServer: App): Promise<string> {
  const response = await request(httpServer)
    .post('/api/v1/auth/login')
    .send({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
    });

  if (response.status !== 200) {
    throw new Error(`Login failed with status ${response.status}: ${JSON.stringify(response.body)}`);
  }

  const cookies = response.headers['set-cookie'] || [];

  // Extract only the cookie name=value pairs (before the first semicolon)
  // set-cookie headers look like: "access_token=xyz; Path=/; HttpOnly"
  // We need to extract just "access_token=xyz"
  const cookieValues = cookies.map(cookie => cookie.split(';')[0].trim());

  // Join multiple cookies with '; ' as per HTTP spec
  return cookieValues.join('; ');
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
