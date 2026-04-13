import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkerEntity } from './worker.entity';
import { WorkersService } from './workers.service';
import { WorkersController } from './workers.controller';
import { WorkersGateway } from './workers.gateway';
import { AuthGuardsModule } from '../auth/guards/auth-guards.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkerEntity]),
    AuthGuardsModule,
  ],
  controllers: [WorkersController],
  providers: [WorkersService, WorkersGateway],
  exports: [WorkersService],
})
export class WorkersModule {}
