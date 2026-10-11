import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiProviderEntity } from './ai-provider.entity';
import { AiModelSelectionEntity } from './ai-model-selection.entity';
import { AiProvidersService } from './ai-providers.service';
import { AiProviderModelsService } from './ai-provider-models.service';
import { AiModelSelectionsService } from './ai-model-selections.service';
import { AiProvidersController } from './ai-providers.controller';
import { AiModelSelectionsController } from './ai-model-selections.controller';
import { AuthGuardsModule } from '../auth/guards/auth-guards.module';
import { SecretsModule } from '../secrets/secrets.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AiProviderEntity, AiModelSelectionEntity]),
    AuthGuardsModule,
    SecretsModule,
  ],
  controllers: [AiProvidersController, AiModelSelectionsController],
  providers: [AiProvidersService, AiProviderModelsService, AiModelSelectionsService],
  exports: [AiProvidersService, AiModelSelectionsService],
})
export class AiProvidersModule {}
