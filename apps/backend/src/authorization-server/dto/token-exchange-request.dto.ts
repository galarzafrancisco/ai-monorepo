import { IsString, IsEnum, IsOptional, Matches } from 'class-validator';

export class TokenExchangeRequestDto {
  @IsEnum(['urn:ietf:params:oauth:grant-type:token-exchange'])
  grant_type!: 'urn:ietf:params:oauth:grant-type:token-exchange';

  @IsString()
  subject_token!: string;

  @IsEnum(['urn:ietf:params:oauth:token-type:access_token'])
  subject_token_type!: 'urn:ietf:params:oauth:token-type:access_token';

  @IsString()
  resource!: string;

  @IsOptional()
  @IsString()
  @Matches(/^[\w\s\-\.:/]+$/, {
    message: 'Scope must be a space-delimited list of valid scope strings',
  })
  scope?: string;
}
