import { Module } from '@nestjs/common';
import { LlmHelperService } from './llm-helper.service';

@Module({
  providers: [LlmHelperService],
  exports: [LlmHelperService],
})
export class LlmHelperModule {}
