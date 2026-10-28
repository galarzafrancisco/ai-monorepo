import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsString, MaxLength } from 'class-validator';

export const MAX_LOOKUP_REFS = 50;

export class LookupIssuesDto {
  @ApiProperty({
    type: [String],
    description: `Issue links or owner/repo#number references (host/owner/repo#number on a GitHub Enterprise), at most ${MAX_LOOKUP_REFS}`,
    example: ['https://github.com/acme/api/issues/12', 'acme/web#3'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_LOOKUP_REFS)
  @IsString({ each: true })
  @MaxLength(2048, { each: true })
  refs!: string[];
}
