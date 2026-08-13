import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatProviderEntity } from './chat-provider.entity';
import { ChatProvidersService } from './chat-providers.service';
import { ChatProvidersController } from './chat-providers.controller';
import { AuthGuardsModule } from '../auth/guards/auth-guards.module';
import { SecretsModule } from '../secrets/secrets.module';
import { UpdateChatProviderUseCase } from './use-cases/update-chat-provider.use-case';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChatProviderEntity]),
    AuthGuardsModule,
    SecretsModule,
  ],
  controllers: [ChatProvidersController],
  providers: [ChatProvidersService, UpdateChatProviderUseCase],
  exports: [ChatProvidersService],
})
export class ChatProvidersModule {}
