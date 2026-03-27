import { Module } from '@nestjs/common';
import { ChatProvidersModule } from '../chat-providers/chat-providers.module';
import { OpenAiResponsesService } from './openai-responses.service';

@Module({
  imports: [ChatProvidersModule],
  providers: [OpenAiResponsesService],
  exports: [OpenAiResponsesService],
})
export class LlmModule {}
