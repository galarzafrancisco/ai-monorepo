import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { AiModelJob } from '../../enums';

export class AiModelSelectionParamsDto {
  @ApiProperty({
    description: 'The job the model is selected for',
    enum: AiModelJob,
    example: AiModelJob.CONVERSATION,
  })
  @IsEnum(AiModelJob)
  job!: AiModelJob;
}
