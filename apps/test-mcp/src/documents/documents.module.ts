import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { Documents } from './documents';

@Module({
  providers: [DocumentsService, Documents],
  controllers: [DocumentsController]
})
export class DocumentsModule {}
