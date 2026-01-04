import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { IdentityProviderService } from '../src/identity-provider/identity-provider.service';

async function createUser() {
  // Get command line arguments
  const email = process.argv[2];
  const password = process.argv[3];
  const displayName = process.argv[4] || email.split('@')[0];

  if (!email || !password) {
    console.error('Usage: npm run create-user <email> <password> [displayName]');
    process.exit(1);
  }

  console.log(`Creating user: ${email}`);

  // Bootstrap the application to get access to services
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const identityService = app.get(IdentityProviderService);

    // Create the user
    const user = await identityService.createUser(email, displayName, password);

    console.log('User created successfully:');
    console.log(`  ID: ${user.id}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Display Name: ${user.displayName}`);
    console.log(`  Role: ${user.role}`);
    console.log(`  Active: ${user.isActive}`);
  } catch (error) {
    console.error('Failed to create user:', error.message);
    process.exit(1);
  } finally {
    await app.close();
  }
}

createUser();
