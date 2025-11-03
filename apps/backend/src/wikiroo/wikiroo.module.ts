import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WikirooService } from './wikiroo.service';
import { WikirooController } from './wikiroo.controller';
import { WikiPageEntity } from './page.entity';

@Module({
  imports: [TypeOrmModule.forFeature([WikiPageEntity])],
  controllers: [WikirooController],
  providers: [WikirooService],
  exports: [WikirooService],
})
export class WikirooModule {}
