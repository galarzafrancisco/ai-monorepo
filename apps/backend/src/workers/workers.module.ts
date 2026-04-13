import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkerEntity } from './worker.entity';
import { WorkersService } from './workers.service';

@Module({
  imports: [TypeOrmModule.forFeature([WorkerEntity])],
  providers: [WorkersService],
  exports: [WorkersService],
})
export class WorkersModule {}
