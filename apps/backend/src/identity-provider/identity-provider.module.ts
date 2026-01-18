import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { ActorEntity } from './actor.entity';
import { IdentityProviderService } from './identity-provider.service';
import { ActorService } from './actor.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, ActorEntity])],
  providers: [IdentityProviderService, ActorService],
  exports: [IdentityProviderService, ActorService, TypeOrmModule],
})
export class IdentityProviderModule {}
