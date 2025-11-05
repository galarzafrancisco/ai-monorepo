import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientRegistrationService } from './client-registration.service';
import { ClientRegistrationController } from './client-registration.controller';
import { RegisteredClientEntity } from './registered-client.entity';

@Module({
  imports: [TypeOrmModule.forFeature([RegisteredClientEntity])],
  providers: [ClientRegistrationService],
  controllers: [ClientRegistrationController],
  exports: [ClientRegistrationService],
})
export class AuthorizationServerModule {}
