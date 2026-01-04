import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WikirooService } from './wikiroo.service';
import { WikirooController } from './wikiroo.controller';
import { WikiPageEntity } from './page.entity';
import { WikiTagEntity } from './tag.entity';
import { WikirooMcpGateway } from './wikiroo.mcp.gateway';
import { WikirooGateway } from './wikiroo.gateway';
import { AuthorizationServerModule } from '../authorization-server/authorization-server.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WikiPageEntity, WikiTagEntity]),
    AuthorizationServerModule,
  ],
  controllers: [WikirooController],
  providers: [WikirooService, WikirooMcpGateway, WikirooGateway],
  exports: [WikirooService],
})
export class WikirooModule {}
