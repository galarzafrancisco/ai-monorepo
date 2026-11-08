import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class SwitchWorkspaceRequestDto {
  @ApiProperty({
    description: 'The workspace to switch to. The person must be a member of it.',
    format: 'uuid',
  })
  @IsUUID()
  workspaceId!: string;
}
