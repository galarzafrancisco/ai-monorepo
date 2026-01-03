#!/usr/bin/env node
/**
 * Script to create an initial test user for MCP Portal
 *
 * This script creates a test user with credentials:
 * - Email: test@example.com
 * - Password: testpassword
 * - Display Name: Test User
 *
 * Usage:
 *   npm run init-test-user           # Creates standard user
 *   npm run init-test-user admin     # Creates admin user
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { IdentityProviderService } from '../identity-provider/identity-provider.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const identityService = app.get(IdentityProviderService);

  const testEmail = 'test@example.com';
  const testPassword = 'testpassword';
  const testDisplayName = 'Test User';
  const role = process.argv[2] === 'admin' ? 'admin' : 'standard';

  try {
    console.log(`Creating test user (${role})...`);
    const user = await identityService.createUser(
      testEmail,
      testDisplayName,
      testPassword,
    );

    // Update role if admin
    if (role === 'admin') {
      await identityService.updateUserRole(user.id, 'admin');
    }

    console.log('✅ Test user created successfully!');
    console.log('');
    console.log('Login credentials:');
    console.log('  Email:', testEmail);
    console.log('  Password:', testPassword);
    console.log('  User ID:', user.id);
    console.log('  Role:', role);
    console.log('');
  } catch (error: any) {
    if (error.code === '23505') {
      // Unique constraint violation
      console.log('ℹ️  Test user already exists');
      console.log('');
      console.log('Login credentials:');
      console.log('  Email:', testEmail);
      console.log('  Password:', testPassword);
      console.log('');
    } else {
      console.error('❌ Error creating test user:', error.message);
      process.exit(1);
    }
  }

  await app.close();
}

bootstrap();
