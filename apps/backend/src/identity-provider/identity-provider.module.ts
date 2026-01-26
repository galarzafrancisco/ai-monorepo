import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { ActorEntity } from './actor.entity';
import { IdentityProviderService } from './identity-provider.service';
import { ActorService } from './actor.service';
import { ActorController } from './actor.controller';
import { AuthGuardsModule } from 'src/auth/guards/auth-guards.module';
import { SearchModule } from 'src/search/search.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, ActorEntity]), AuthGuardsModule, SearchModule],
  controllers: [ActorController],
  providers: [IdentityProviderService, ActorService],
  exports: [IdentityProviderService, ActorService, TypeOrmModule],
})
export class IdentityProviderModule {}
