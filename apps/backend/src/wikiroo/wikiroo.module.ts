import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WikirooService } from './wikiroo.service';
import { WikirooController } from './wikiroo.controller';
import { WikiPageEntity } from './page.entity';
import { WikiTagEntity } from './tag.entity';
import { WikirooMcpGateway } from './wikiroo.mcp.gateway';
import { WikirooGateway } from './wikiroo.gateway';

@Module({
  imports: [TypeOrmModule.forFeature([WikiPageEntity, WikiTagEntity])],
  controllers: [WikirooController],
  providers: [WikirooService, WikirooMcpGateway, WikirooGateway],
  exports: [WikirooService],
})
export class WikirooModule {}
