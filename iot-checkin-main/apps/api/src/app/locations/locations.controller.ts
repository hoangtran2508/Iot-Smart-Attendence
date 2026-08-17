import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  CreateLocationRequest,
  DeleteResponse,
  JoinLocationRequest,
  LocationResponse,
  UpdateLocationRequest,
} from 'libs';
import { LocationsService } from './locations.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { User } from '../auth/user.decorator';

@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Post()
  create(
    @Body() dto: CreateLocationRequest,
    @User() user: AuthenticatedUser,
  ): Promise<LocationResponse> {
    return this.locationsService.create(dto, user.id);
  }

  @Post('join')
  join(
    @Body() dto: JoinLocationRequest,
    @User() user: AuthenticatedUser,
  ): Promise<LocationResponse> {
    return this.locationsService.joinByCode(user.id, dto.code);
  }

  @Get()
  findAll(@User() user: AuthenticatedUser): Promise<LocationResponse[]> {
    return this.locationsService.findAllForUser(user.id, user.role);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @User() user: AuthenticatedUser,
  ): Promise<LocationResponse> {
    return this.locationsService.findOne(id, user.id, user.role);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateLocationRequest,
    @User() user: AuthenticatedUser,
  ): Promise<LocationResponse> {
    return this.locationsService.update(id, dto, user.id, user.role);
  }


  @Delete(':id/users/:userId')
  async removeUser(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @User() user: AuthenticatedUser,
  ): Promise<LocationResponse> {
    return this.locationsService.removeUser(id, userId, user.id, user.role);
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @User() user: AuthenticatedUser,
  ): Promise<DeleteResponse> {
    await this.locationsService.remove(id, user.id, user.role);
    return { deleted: true };
  }
}
