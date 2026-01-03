import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RefreshToken } from './refresh-token.entity';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { IdentityProviderModule } from '../identity-provider/identity-provider.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([RefreshToken]),
    IdentityProviderModule,
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
