import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WikirooService } from './wikiroo.service';
import { WikirooController } from './wikiroo.controller';
import { WikiPageEntity } from './page.entity';
import { WikiTagEntity } from './tag.entity';
import { WikirooMcpGateway } from './wikiroo.mcp.gateway';

@Module({
  imports: [TypeOrmModule.forFeature([WikiPageEntity, WikiTagEntity])],
  controllers: [WikirooController],
  providers: [WikirooService, WikirooMcpGateway],
  exports: [WikirooService],
})
export class WikirooModule {}
