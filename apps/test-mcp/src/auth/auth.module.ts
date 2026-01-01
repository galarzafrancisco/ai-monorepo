import { Module } from '@nestjs/common';
import { JwtValidationService } from './jwt-validation.service';
import { TokenExchangeService } from './token-exchange.service';

@Module({
  providers: [JwtValidationService, TokenExchangeService],
  exports: [JwtValidationService, TokenExchangeService],
})
export class AuthModule {}
