import { Module } from '@nestjs/common';
import { AdkService } from './adk.service';
import { AdkController } from './adk.controller';

@Module({
  controllers: [AdkController],
  providers: [AdkService],
  exports: [AdkService],
})
export class AdkModule {}
