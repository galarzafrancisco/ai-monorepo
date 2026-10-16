import { IsOptional, IsString, ValidateBy } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { isIanaTimeZone } from '../time/time-context';

export class CreateThreadMessageDto {
  @ApiProperty({
    description: 'Content of the message',
    example: 'What is the status of this feature?',
  })
  @IsString()
  content!: string;

  @ApiPropertyOptional({
    description:
      "IANA timezone of the person writing, as their client reports it. Lets the threads agent read relative times such as \"tomorrow at 5pm\". Raw offsets are rejected.",
    example: 'Australia/Sydney',
  })
  @IsOptional()
  @ValidateBy({
    name: 'isIanaTimeZone',
    validator: {
      validate: (value: unknown) => isIanaTimeZone(value),
      defaultMessage: () => 'timezone must be an IANA timezone name such as "Australia/Sydney"',
    },
  })
  timezone?: string;
}
