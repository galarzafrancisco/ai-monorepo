import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { Documents } from './documents';
import { AuthModule } from 'src/auth/auth.module';
import { GcsService } from './gcs.service';

@Module({
  imports: [AuthModule],
  providers: [DocumentsService, Documents, GcsService],
  controllers: [DocumentsController]
})
export class DocumentsModule { }
