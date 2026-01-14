import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { Documents } from './documents';
import { AuthGuardsModule } from 'src/auth/auth.module';
import { GcsService } from './gcs.service';

@Module({
  imports: [AuthGuardsModule],
  providers: [DocumentsService, Documents, GcsService],
  controllers: [DocumentsController]
})
export class DocumentsModule { }
