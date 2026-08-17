import { Injectable } from '@nestjs/common';
import { UserResponse } from 'libs';
import { User } from '../../entities/user.entity';

@Injectable()
export class UserFactoryService {
   toUserResponse(user: User): UserResponse {
      return {
         id: user.id,
         name: user.name,
         email: user.email,
         phoneNumber: user.phoneNumber ?? null,
         role: user.role,
         createdAt: user.createdAt.toISOString(),
         updatedAt: user.updatedAt.toISOString(),
      };
   }
}
