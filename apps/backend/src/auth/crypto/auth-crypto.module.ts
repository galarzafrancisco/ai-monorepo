import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IssuedAccessTokenEntity } from 'src/authorization-server/entities/issued-access-token.entity';
import { IssuedTokenRevocationService } from './issued-token-revocation.service';
import { JwksKeyEntity } from './jwks-key.entity';
import { JwksKeyStore } from './jwks-key.store';
import { JwksService } from './jwks.service';
import { JwksController } from './jwks.controller';
import { TokenVerifierService } from './token-verifier.service';
import { TokenSignerService } from './token-signer.service';

@Module({
  imports: [TypeOrmModule.forFeature([JwksKeyEntity, IssuedAccessTokenEntity])],
  providers: [
    JwksKeyStore,
    JwksService,
    IssuedTokenRevocationService,
    TokenVerifierService,
    TokenSignerService,
  ],
  controllers: [JwksController],
  exports: [JwksService, TokenVerifierService, TokenSignerService],
})
export class AuthCryptoModule {}
