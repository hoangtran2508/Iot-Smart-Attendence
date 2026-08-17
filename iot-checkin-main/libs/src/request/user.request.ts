import type { UserRole } from '../shared';



export interface UpdateUserRequest {
  name?: string;
  email?: string;
  phoneNumber?: string;
}

export interface UpdateUserRoleRequest {
  role: UserRole;
}
