import { Module } from '@nestjs/common';
import { OpenAiResponsesService } from './openai-responses.service';

@Module({
  providers: [OpenAiResponsesService],
  exports: [OpenAiResponsesService],
})
export class LlmModule {}
