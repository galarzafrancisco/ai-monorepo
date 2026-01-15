import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for the flowId path parameter used to retrieve authorization flow details.
 */
export class GetConsentMetadataParamsDto {
  @ApiProperty({
    description: 'Unique identifier of the authorization flow',
    example: 'b15e8a76-5b6d-4bde-9a3b-26fdbaab5b4c',
  })
  @IsUUID()
  flowId!: string;
}
