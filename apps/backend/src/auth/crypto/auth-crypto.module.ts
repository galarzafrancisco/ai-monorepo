import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwksKeyEntity } from './jwks-key.entity';
import { JwksService } from './jwks.service';
import { JwksController } from './jwks.controller';
import { TokenVerifierService } from './token-verifier.service';
import { TokenSignerService } from './token-signer.service';


@Module({
  imports: [
    TypeOrmModule.forFeature([
      JwksKeyEntity,
    ]),
  ],
  providers: [
    JwksService,
    TokenVerifierService,
    TokenSignerService,
  ],
  controllers: [
    JwksController,
  ],
  exports: [
    JwksService,
    TokenVerifierService,
    TokenSignerService,
  ],
})
export class AuthCryptoModule {}
