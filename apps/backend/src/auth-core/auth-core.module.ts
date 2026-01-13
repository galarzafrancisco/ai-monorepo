import { Module } from '@nestjs/common';

/**
 * Auth Core Module
 *
 * Provides shared authentication primitives (types, constants, errors)
 * that can be imported by both the auth module and authorization-server module
 * without creating circular dependencies.
 *
 * This module has no providers or imports - it serves as a namespace
 * for pure, dependency-free utilities.
 */
@Module({
  // No providers or imports - just a namespace for shared types/constants
})
export class AuthCoreModule {}
