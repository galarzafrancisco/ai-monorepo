import { Module } from '@nestjs/common';
import { JwtValidationService } from './jwt-validation.service';

@Module({
  providers: [JwtValidationService],
  exports: [JwtValidationService],
})
export class AuthModule {}
