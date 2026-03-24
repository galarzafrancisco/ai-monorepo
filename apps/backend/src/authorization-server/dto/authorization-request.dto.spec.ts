import { validate } from 'class-validator';
import { AuthorizationRequestDto } from './authorization-request.dto';
import { ResponseType } from '../enums';

describe('AuthorizationRequestDto', () => {
  const createValidDto = (): AuthorizationRequestDto => {
    const dto = new AuthorizationRequestDto();
    dto.response_type = ResponseType.CODE;
    dto.client_id = 'client-id';
    dto.code_challenge = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_1';
    dto.code_challenge_method = 'S256';
    dto.redirect_uri = 'http://127.0.0.1:53299/callback';
    dto.state = 'state-value';
    dto.scope = 'tasks:read';
    return dto;
  };

  it('allows authorization requests without resource', async () => {
    const dto = createValidDto();

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('still validates resource format when resource is provided', async () => {
    const dto = createValidDto();
    dto.resource = 'not-a-url';

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'resource')).toBe(true);
  });
});
