import { ApiProperty } from '@nestjs/swagger';
import { AdkSessionResponseDto } from './adk-session-response.dto';

export class AdkListSessionsResponseDto {
  @ApiProperty({
    description: 'List of ADK sessions',
    type: [AdkSessionResponseDto],
  })
  sessions!: AdkSessionResponseDto[];
}
