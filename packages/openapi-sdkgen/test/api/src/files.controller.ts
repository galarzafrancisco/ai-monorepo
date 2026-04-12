import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Header,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody, ApiProperty } from '@nestjs/swagger';

export class FileUploadResponseDto {
  @ApiProperty({ type: String })
  filename: string;

  @ApiProperty({ type: Number })
  size: number;

  @ApiProperty({ type: String })
  mimetype: string;

  @ApiProperty({ type: String })
  uploadedAt: string;
}

export class MultipleFilesUploadResponseDto {
  @ApiProperty({ type: [FileUploadResponseDto] })
  files: FileUploadResponseDto[];

  @ApiProperty({ type: Number })
  totalSize: number;
}

export class FileWithMetadataDto {
  @ApiProperty({ type: String })
  title: string;

  @ApiProperty({ type: String })
  description: string;

  @ApiProperty({ type: [String] })
  tags: string[];
}

export class FileWithMetadataResponseDto {
  @ApiProperty({ type: String })
  filename: string;

  @ApiProperty({ type: String })
  title: string;

  @ApiProperty({ type: String })
  description: string;

  @ApiProperty({ type: [String] })
  tags: string[];
}

export class BinaryUploadResponseDto {
  @ApiProperty({ type: Number })
  bytesReceived: number;

  @ApiProperty({ type: String })
  contentType: string;
}

export class FileDownloadInfoDto {
  @ApiProperty({ type: String })
  filename: string;

  @ApiProperty({ type: String })
  contentType: string;

  @ApiProperty({ type: Number })
  size: number;
}

@ApiTags('files')
@Controller('files')
export class FilesController {
  @Post('upload/single')
  @ApiOperation({ summary: 'Upload a single file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ status: 201, type: FileUploadResponseDto })
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  uploadSingleFile(@UploadedFile() _file: any): FileUploadResponseDto {
    // Mock response - in real implementation would use multer or similar
    return {
      filename: 'uploaded-file.txt',
      size: 1024,
      mimetype: 'text/plain',
      uploadedAt: new Date().toISOString(),
    };
  }

  @Post('upload/multiple')
  @ApiOperation({ summary: 'Upload multiple files' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
      },
    },
  })
  @ApiResponse({ status: 201, type: MultipleFilesUploadResponseDto })
  @HttpCode(HttpStatus.CREATED)
  uploadMultipleFiles(@Body() body: any): MultipleFilesUploadResponseDto {
    // Mock response
    const files = [
      { filename: 'file1.txt', size: 512, mimetype: 'text/plain', uploadedAt: new Date().toISOString() },
      { filename: 'file2.jpg', size: 2048, mimetype: 'image/jpeg', uploadedAt: new Date().toISOString() },
    ];
    return {
      files,
      totalSize: files.reduce((sum, f) => sum + f.size, 0),
    };
  }

  @Post('upload/with-metadata')
  @ApiOperation({ summary: 'Upload file with additional metadata fields' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        title: {
          type: 'string',
        },
        description: {
          type: 'string',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
        },
      },
      required: ['file', 'title'],
    },
  })
  @ApiResponse({ status: 201, type: FileWithMetadataResponseDto })
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  uploadFileWithMetadata(
    @UploadedFile() _file: any,
    @Body() body: any,
  ): FileWithMetadataResponseDto {
    // Mock response
    return {
      filename: 'document.pdf',
      title: body.title || 'Untitled',
      description: body.description || '',
      tags: body.tags || [],
    };
  }

  @Post('upload/binary')
  @ApiOperation({ summary: 'Upload binary data' })
  @ApiConsumes('application/octet-stream')
  @ApiBody({
    schema: {
      type: 'string',
      format: 'binary',
    },
  })
  @ApiResponse({ status: 201, type: BinaryUploadResponseDto })
  @HttpCode(HttpStatus.CREATED)
  uploadBinary(@Body() body: Buffer): BinaryUploadResponseDto {
    // Mock response
    return {
      bytesReceived: 4096,
      contentType: 'application/octet-stream',
    };
  }

  @Get('download/:filename')
  @ApiOperation({ summary: 'Download a file' })
  @ApiResponse({
    status: 200,
    description: 'File download',
    content: {
      'application/octet-stream': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
    headers: {
      'Content-Disposition': {
        schema: { type: 'string' },
        description: 'Attachment filename',
      },
    },
  })
  @Header('Content-Type', 'application/octet-stream')
  @Header('Content-Disposition', 'attachment; filename="downloaded-file.bin"')
  downloadFile(@Param('filename') filename: string): Buffer {
    // Mock binary response
    return Buffer.from('Mock file content');
  }

  @Get('download/text/:filename')
  @ApiOperation({ summary: 'Download a text file' })
  @ApiResponse({
    status: 200,
    description: 'Text file download',
    content: {
      'text/plain': {
        schema: {
          type: 'string',
        },
      },
    },
    headers: {
      'Content-Disposition': {
        schema: { type: 'string' },
        description: 'Attachment filename',
      },
    },
  })
  @Header('Content-Type', 'text/plain')
  @Header('Content-Disposition', 'attachment; filename="data.txt"')
  downloadTextFile(@Param('filename') filename: string): string {
    return 'This is the content of the text file';
  }

  @Get('download/csv/:filename')
  @ApiOperation({ summary: 'Download a CSV file' })
  @ApiResponse({
    status: 200,
    description: 'CSV file download',
    content: {
      'text/csv': {
        schema: {
          type: 'string',
        },
      },
    },
    headers: {
      'Content-Disposition': {
        schema: { type: 'string' },
        description: 'Attachment filename',
      },
    },
  })
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="data.csv"')
  downloadCsvFile(@Param('filename') filename: string): string {
    return 'id,name,value\n1,Item1,100\n2,Item2,200';
  }

  @Get('download/pdf/:filename')
  @ApiOperation({ summary: 'Download a PDF file' })
  @ApiResponse({
    status: 200,
    description: 'PDF file download',
    content: {
      'application/pdf': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
    headers: {
      'Content-Disposition': {
        schema: { type: 'string' },
        description: 'Attachment filename',
      },
    },
  })
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'attachment; filename="document.pdf"')
  downloadPdfFile(@Param('filename') filename: string): Buffer {
    // Mock PDF content
    return Buffer.from('Mock PDF content');
  }

  @Get('download/image/:filename')
  @ApiOperation({ summary: 'Download an image file' })
  @ApiResponse({
    status: 200,
    description: 'Image file download',
    content: {
      'image/png': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
    headers: {
      'Content-Disposition': {
        schema: { type: 'string' },
        description: 'Attachment filename',
      },
    },
  })
  @Header('Content-Type', 'image/png')
  @Header('Content-Disposition', 'inline; filename="image.png"')
  downloadImageFile(@Param('filename') filename: string): Buffer {
    // Mock image content
    return Buffer.from('Mock PNG content');
  }

  @Get('info/:filename')
  @ApiOperation({ summary: 'Get file information without downloading' })
  @ApiResponse({ status: 200, type: FileDownloadInfoDto })
  getFileInfo(@Param('filename') filename: string): FileDownloadInfoDto {
    return {
      filename,
      contentType: 'application/octet-stream',
      size: 4096,
    };
  }
}
