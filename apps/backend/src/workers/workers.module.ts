import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthGuardsModule } from 'src/auth/guards/auth-guards.module';
import { WorkerEntity } from './worker.entity';
import { WorkersGateway } from './workers.gateway';
import { WorkersService } from './workers.service';

@Module({
  imports: [TypeOrmModule.forFeature([WorkerEntity]), AuthGuardsModule],
  providers: [WorkersService, WorkersGateway],
  exports: [WorkersService],
})
export class WorkersModule {}
