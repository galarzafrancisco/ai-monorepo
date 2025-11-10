import {
  Controller,
  All,
  Req,
  Res,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Documents } from './documents';
import { AuthGuard } from 'src/auth/auth.guard';
import { Auth } from 'src/auth/auth.decorator';
import type { AuthContext } from 'src/auth/auth.types';

@Controller('documents')
@UseGuards(AuthGuard)
export class DocumentsController {
  private logger = new Logger(DocumentsController.name);

  constructor(
    private readonly documents: Documents,
  ) {}

  @All('mcp')
  async handleMcp(@Auth() auth: AuthContext, @Req() req: Request, @Res() res: Response) {
    await this.documents.handleRequest(auth, req, res);
  }
}
