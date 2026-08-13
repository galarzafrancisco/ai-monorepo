import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutboxDispatcherService } from './outbox-dispatcher.service';
import { OutboxEventEntity } from './outbox-event.entity';
import { OutboxWriterService } from './outbox-writer.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([OutboxEventEntity])],
  providers: [OutboxWriterService, OutboxDispatcherService],
  exports: [OutboxWriterService],
})
export class OutboxModule {}
