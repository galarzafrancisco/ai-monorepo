import { Injectable, Logger } from '@nestjs/common';
import { Storage } from '@google-cloud/storage';
import { GCS_BUCKET_NAME } from '../config/self.config';

export interface GcsFile {
  name: string;
  size: number;
  updated: string;
  contentType?: string;
}

@Injectable()
export class GcsService {
  private readonly logger = new Logger(GcsService.name);

  async listBucketContents(accessToken: string, bucketName?: string): Promise<GcsFile[]> {
    const bucket = bucketName || GCS_BUCKET_NAME;

    this.logger.debug(`Listing contents of bucket: ${bucket}`);

    try {
      const storage = new Storage({
        authClient: {
          getAccessToken: async () => ({
            token: accessToken,
          }),
        } as any,
      });

      const [files] = await storage.bucket(bucket).getFiles();

      const fileList: GcsFile[] = files.map(file => ({
        name: file.name,
        size: parseInt(file.metadata.size || '0'),
        updated: file.metadata.updated || '',
        contentType: file.metadata.contentType,
      }));

      this.logger.debug(`Found ${fileList.length} files in bucket ${bucket}`);
      return fileList;
    } catch (error) {
      this.logger.error(`Error listing bucket contents: ${error.message}`, error);
      throw error;
    }
  }
}
