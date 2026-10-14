import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiProviderEntity } from './ai-provider.entity';
import { AiModelSelectionEntity } from './ai-model-selection.entity';
import { AiProviderConnectionEntity } from './ai-provider-connection.entity';
import { AiProviderAuthorizationAttemptEntity } from './ai-provider-authorization-attempt.entity';
import { AiProvidersService } from './ai-providers.service';
import { AiProviderModelsService } from './ai-provider-models.service';
import { AiModelSelectionsService } from './ai-model-selections.service';
import { AiProvidersController } from './ai-providers.controller';
import { AiModelSelectionsController } from './ai-model-selections.controller';
import { AiProviderConnectionsController } from './ai-provider-connections.controller';
import { ChatgptConnectionsService } from './chatgpt-subscription/chatgpt-connections.service';
import { ChatgptLoopbackListenerService } from './chatgpt-subscription/chatgpt-loopback-listener.service';
import { ChatgptOAuthClient } from './chatgpt-subscription/chatgpt-oauth.client';
import { ChatgptSubscriptionService } from './chatgpt-subscription/chatgpt-subscription.service';
import {
  CHATGPT_SUBSCRIPTION_ENDPOINTS,
  DEFAULT_CHATGPT_SUBSCRIPTION_ENDPOINTS,
} from './chatgpt-subscription/chatgpt-subscription.constants';
import { AuthGuardsModule } from '../auth/guards/auth-guards.module';
import { SecretsModule } from '../secrets/secrets.module';
import { User } from '../identity-provider/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AiProviderEntity,
      AiModelSelectionEntity,
      AiProviderConnectionEntity,
      AiProviderAuthorizationAttemptEntity,
      User,
    ]),
    AuthGuardsModule,
    SecretsModule,
  ],
  controllers: [
    AiProvidersController,
    AiModelSelectionsController,
    AiProviderConnectionsController,
  ],
  providers: [
    AiProvidersService,
    AiProviderModelsService,
    AiModelSelectionsService,
    { provide: CHATGPT_SUBSCRIPTION_ENDPOINTS, useValue: DEFAULT_CHATGPT_SUBSCRIPTION_ENDPOINTS },
    ChatgptOAuthClient,
    ChatgptLoopbackListenerService,
    ChatgptConnectionsService,
    ChatgptSubscriptionService,
  ],
  exports: [AiProvidersService, AiModelSelectionsService, ChatgptSubscriptionService],
})
export class AiProvidersModule {}
