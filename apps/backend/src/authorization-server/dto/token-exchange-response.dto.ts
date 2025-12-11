export class TokenExchangeResponseDto {
  access_token!: string;
  issued_token_type!: string;
  token_type!: string;
  expires_in!: number;
  scope!: string;

  constructor(
    accessToken: string,
    issuedTokenType: string,
    tokenType: string,
    expiresIn: number,
    scope: string,
  ) {
    this.access_token = accessToken;
    this.issued_token_type = issuedTokenType;
    this.token_type = tokenType;
    this.expires_in = expiresIn;
    this.scope = scope;
  }
}
