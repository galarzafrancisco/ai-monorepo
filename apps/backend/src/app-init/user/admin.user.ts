import { CreateUserInput } from 'src/identity-provider/dto/service/identity-provider.service.types';
import { UserRole } from 'src/identity-provider/enums';

export const adminUser: CreateUserInput = {
  email: 'admin@test.com',
  slug: 'admin',
  displayName: 'Admin user',
  password: 'admin',
};
export const adminUserRole: UserRole = UserRole.ADMIN;
