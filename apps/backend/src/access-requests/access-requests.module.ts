import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthGuardsModule } from '../auth/guards/auth-guards.module';
import { ActorEntity } from '../identity-provider/actor.entity';
import { AccessRequestEntity } from './access-request.entity';
import { AccessRequestsAdminController, AccessRequestsController } from './access-requests.controller';
import { AccessRequestsService } from './access-requests.service';

@Module({
  imports: [TypeOrmModule.forFeature([AccessRequestEntity, ActorEntity]), AuthGuardsModule],
  controllers: [AccessRequestsController, AccessRequestsAdminController],
  providers: [AccessRequestsService],
})
export class AccessRequestsModule {}
