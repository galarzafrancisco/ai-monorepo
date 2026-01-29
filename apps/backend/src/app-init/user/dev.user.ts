import { CreateUserInput } from 'src/identity-provider/dto/service/identity-provider.service.types';
import { UserRole } from 'src/identity-provider/enums';

export const devUser: CreateUserInput = {
  email: 'dev@test.com',
  slug: 'dev',
  displayName: 'Dev user',
  password: 'dev',
};
export const devUserRole: UserRole = UserRole.STANDARD;
