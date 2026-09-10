import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatProviderEntity } from './chat-provider.entity';
import { ChatProvidersService } from './chat-providers.service';
import { ChatProvidersController } from './chat-providers.controller';
import { AuthGuardsModule } from '../auth/guards/auth-guards.module';
import { SecretsModule } from '../secrets/secrets.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChatProviderEntity]),
    AuthGuardsModule,
    SecretsModule,
  ],
  controllers: [ChatProvidersController],
  providers: [ChatProvidersService],
  exports: [ChatProvidersService],
})
export class ChatProvidersModule {}
