import { randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { InvalidCredentialsError } from '../core/errors.js';
import type { IdentityProvider } from '../core/ports.js';
import type { Subject } from '../core/types.js';

/*
 * A small identity provider: users with an email and a password hash.
 * Enough for an app that owns its users; swap in your own IdentityProvider
 * to delegate to something else.
 */

export type LocalUser = {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string | null;
  isActive: boolean;
  /** Free-form attributes, copied onto the Subject (role, tenant, ...) */
  attributes: Record<string, unknown>;
  createdAt: Date;
};

export interface UserStore {
  findByEmail(email: string): Promise<LocalUser | null>;
  findById(id: string): Promise<LocalUser | null>;
  save(user: LocalUser): Promise<LocalUser>;
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, hash: string): Promise<boolean>;
}

const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_COST = { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

const scryptAsync = (password: string, salt: Buffer): Promise<Buffer> =>
  new Promise((resolve, reject) =>
    scrypt(password, salt, SCRYPT_KEY_LENGTH, SCRYPT_COST, (error, key) =>
      error ? reject(error) : resolve(key),
    ),
  );

/** Password hashing with scrypt from Node's crypto: no native dependency */
export function scryptHasher(): PasswordHasher {
  return {
    async hash(password) {
      const salt = randomBytes(16);
      const key = await scryptAsync(password, salt);
      return `scrypt$${salt.toString('base64url')}$${key.toString('base64url')}`;
    },
    async verify(password, hash) {
      const [scheme, salt, key] = hash.split('$');
      if (scheme !== 'scrypt' || !salt || !key) return false;
      const expected = Buffer.from(key, 'base64url');
      const actual = await scryptAsync(password, Buffer.from(salt, 'base64url'));
      return actual.length === expected.length && timingSafeEqual(actual, expected);
    },
  };
}

/**
 * Password hashing with bcrypt, for hosts whose users already have bcrypt
 * hashes. Pass the module in: `bcryptHasher(await import('bcrypt'))`.
 */
export function bcryptHasher(
  bcrypt: {
    hash(password: string, rounds: number): Promise<string>;
    compare(password: string, hash: string): Promise<boolean>;
  },
  rounds = 12,
): PasswordHasher {
  return {
    hash: (password) => bcrypt.hash(password, rounds),
    verify: (password, hash) => bcrypt.compare(password, hash),
  };
}

export type LocalIdpOptions = {
  hasher?: PasswordHasher;
  /** Minimum password length for `createUser` and `setPassword`. Default 8. */
  minPasswordLength?: number;
};

export type LocalIdentityProvider = IdentityProvider & {
  createUser(input: {
    email: string;
    password: string;
    displayName?: string;
    attributes?: Record<string, unknown>;
  }): Promise<Subject>;
  setPassword(userId: string, password: string): Promise<void>;
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export function toSubject(user: LocalUser): Subject {
  return {
    ...user.attributes,
    id: user.id,
    email: user.email,
    ...(user.displayName ? { displayName: user.displayName } : {}),
  };
}

export function localIdp(
  users: UserStore,
  options: LocalIdpOptions = {},
): LocalIdentityProvider {
  const hasher = options.hasher ?? scryptHasher();
  const minPasswordLength = options.minPasswordLength ?? 8;
  // Verified against when the email is unknown, so that case takes as long
  // as a wrong password and does not reveal which emails exist.
  const decoyHash = hasher.hash(randomBytes(16).toString('hex'));

  const assertPassword = (password: string) => {
    if (typeof password !== 'string' || password.length < minPasswordLength) {
      throw new Error(`Password must be at least ${minPasswordLength} characters`);
    }
  };

  return {
    async authenticate({ email, password }) {
      const user = await users.findByEmail(normalizeEmail(email));
      const matches = await hasher.verify(
        password,
        user?.passwordHash ?? (await decoyHash),
      );
      if (!user || !matches || !user.isActive) {
        throw new InvalidCredentialsError();
      }
      return toSubject(user);
    },

    async getSubject(id) {
      const user = await users.findById(id);
      return user && user.isActive ? toSubject(user) : null;
    },

    async createUser(input) {
      assertPassword(input.password);
      const email = normalizeEmail(input.email);
      if (!email.includes('@')) {
        throw new Error('A valid email is required');
      }
      if (await users.findByEmail(email)) {
        throw new Error(`A user with email ${email} already exists`);
      }
      const user = await users.save({
        id: randomUUID(),
        email,
        passwordHash: await hasher.hash(input.password),
        displayName: input.displayName ?? null,
        isActive: true,
        attributes: input.attributes ?? {},
        createdAt: new Date(),
      });
      return toSubject(user);
    },

    async setPassword(userId, password) {
      assertPassword(password);
      const user = await users.findById(userId);
      if (!user) {
        throw new Error(`Unknown user: ${userId}`);
      }
      await users.save({ ...user, passwordHash: await hasher.hash(password) });
    },
  };
}
