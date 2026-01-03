import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { IdentityProviderService } from './identity-provider.service';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [IdentityProviderService],
  exports: [IdentityProviderService],
})
export class IdentityProviderModule {}
