import type { UserRole } from 'libs';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
}
