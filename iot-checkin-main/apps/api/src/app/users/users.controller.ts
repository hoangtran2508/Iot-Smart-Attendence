import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
} from '@nestjs/common';
import {
  DeleteResponse,
  UpdateUserRequest,
  UpdateUserRoleRequest,
  UserResponse,
} from 'libs';
import { UsersService } from './users.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { User } from '../auth/user.decorator';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}


  @Get()
  @Roles('admin')
  findAll(): Promise<UserResponse[]> {
    return this.usersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<UserResponse> {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserRequest,
    @User() user: AuthenticatedUser ,
  ): Promise<UserResponse> {
    if (!user) {
      throw new ForbiddenException('Missing authenticated user');
    }
    if (user.role !== 'admin' && user.id !== id) {
      throw new ForbiddenException('Cannot update another user');
    }
    return this.usersService.update(id, dto);
  }

  @Patch(':id/role')
  @Roles('admin')
  updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleRequest,
  ): Promise<UserResponse> {
    return this.usersService.updateRole(id, dto.role);
  }

  @Get(':id/devices')
  getUserDevices(
    @Param('id') id: string,
    @User() user: AuthenticatedUser,
  ) {
    if (user.role !== 'admin' && user.id !== id) {
      throw new ForbiddenException('Cannot view devices of another user');
    }
    return this.usersService.getUserDevices(id);
  }

  @Delete(':id/devices/:deviceId')
  async removeUserDevice(
    @Param('id') id: string,
    @Param('deviceId') deviceId: string,
    @User() user: AuthenticatedUser,
  ): Promise<DeleteResponse> {
    if (user.role !== 'admin' && user.id !== id) {
      throw new ForbiddenException('Cannot delete device of another user');
    }
    await this.usersService.removeUserDevice(id, deviceId);
    return { deleted: true };
  }
}
