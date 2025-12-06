import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { IdentityProviderService } from './identity-provider.service';
import { IdentityProviderController } from './identity-provider.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [IdentityProviderController],
  providers: [IdentityProviderService],
  exports: [IdentityProviderService],
})
export class IdentityProviderModule {}
