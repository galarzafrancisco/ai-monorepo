import {
  Controller,
  All,
  Req,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Documents } from './documents';

@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly documents: Documents,
  ) {}

  @All('mcp')
  async handleMcp(@Req() req: Request, @Res() res: Response) {
    await this.documents.handleRequest(req, res);
  }
}
