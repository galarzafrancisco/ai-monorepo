import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignTaskDto {
  @ApiProperty({
    description: 'Name of the assignee',
    example: 'AgentAlpha',
  })
  @IsString()
  @IsNotEmpty()
  assignee!: string;
}
