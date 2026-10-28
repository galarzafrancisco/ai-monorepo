import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsString, MaxLength } from 'class-validator';

export const MAX_LOOKUP_REFS = 50;

export class LookupPullRequestsDto {
  @ApiProperty({
    type: [String],
    description: `Pull request links or owner/repo#number references, at most ${MAX_LOOKUP_REFS}`,
    example: ['https://github.com/acme/api/pull/12', 'acme/web#3'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_LOOKUP_REFS)
  @IsString({ each: true })
  @MaxLength(2048, { each: true })
  refs!: string[];
}
