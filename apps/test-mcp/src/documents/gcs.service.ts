import { Injectable, Logger } from '@nestjs/common';
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
      const response = await fetch(
        `https://storage.googleapis.com/storage/v1/b/${bucket}/o`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          }
        }
      )
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to list bucket contents: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();

      const blobs = (data.items || []).map((item: any) => ({
        name: item.name,
        size: item.size,
        timeCreated: item.timeCreated,
        contentType: item.contentType,
      }));

      return blobs;
    } catch (error) {
      this.logger.error('Error listing bucket contents:', error);
      throw error;
    }
  }
}
