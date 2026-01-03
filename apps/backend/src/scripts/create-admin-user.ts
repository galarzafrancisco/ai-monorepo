#!/usr/bin/env node
/**
 * Script to create an admin user for MCP Portal
 *
 * Usage:
 *   npm run create-admin
 *   npm run create-admin <email> <displayName> <password>
 *
 * If arguments are not provided, the script will prompt for input.
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { IdentityProviderService } from '../identity-provider/identity-provider.service';
import * as readline from 'readline';

async function promptInput(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const identityService = app.get(IdentityProviderService);

  // Get parameters from CLI args or prompt
  let email = process.argv[2];
  let displayName = process.argv[3];
  let password = process.argv[4];

  if (!email) {
    email = await promptInput('Enter email: ');
  }

  if (!displayName) {
    displayName = await promptInput('Enter display name: ');
  }

  if (!password) {
    password = await promptInput('Enter password: ');
  }

  // Validate inputs
  if (!email || !displayName || !password) {
    console.error('❌ Error: All fields are required (email, displayName, password)');
    process.exit(1);
  }

  try {
    console.log('Creating admin user...');

    // Create user with standard role first
    const user = await identityService.createUser(
      email,
      displayName,
      password,
    );

    // Update role to admin
    await identityService.updateUserRole(user.id, 'admin');

    console.log('✅ Admin user created successfully!');
    console.log('');
    console.log('Login credentials:');
    console.log('  Email:', email);
    console.log('  Password:', password);
    console.log('  User ID:', user.id);
    console.log('  Role: admin');
    console.log('');
  } catch (error: any) {
    if (error.code === '23505' || error.code === 'SQLITE_CONSTRAINT') {
      // Unique constraint violation - user already exists
      console.log('ℹ️  User with this email already exists');
      console.log('');
      console.log('To update an existing user to admin role, use:');
      console.log('  User lookup and role update functionality (coming soon)');
      console.log('');
    } else {
      console.error('❌ Error creating admin user:', error.message);
      process.exit(1);
    }
  }

  await app.close();
}

bootstrap();
