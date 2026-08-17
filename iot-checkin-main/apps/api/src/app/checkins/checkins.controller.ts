import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  GoneException,
} from '@nestjs/common';
import {
  CheckinResponse,
  CreateCheckinRequest,
  DeleteResponse,
  UpdateCheckinRequest,
  WifiCheckinRequest,
} from 'libs';
import { CheckinsService } from './checkins.service';
import { Roles } from '../auth/roles.decorator';
import { User } from '../auth/user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';

@Controller('checkins')
export class CheckinsController {
  constructor(private readonly checkinsService: CheckinsService) {}

  @Post()
  @Roles('admin')
  create(
    @Body() dto: CreateCheckinRequest,
    @User() user: AuthenticatedUser,
  ): Promise<CheckinResponse> {
    return this.checkinsService.create(dto, user.id);
  }

  @Post('wifi')
  createWifiCheckin(): Promise<CheckinResponse> {
    throw new GoneException('This endpoint is deprecated. Please update your app to use MQTT Wi-Fi Check-in.');
  }

  @Get()
  findAll(@User() user: AuthenticatedUser): Promise<CheckinResponse[]> {
    return this.checkinsService.findAllForUser(user.id, user.role);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @User() user: AuthenticatedUser,
  ): Promise<CheckinResponse> {
    return this.checkinsService.findOne(id, user.id, user.role);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCheckinRequest,
    @User() user: AuthenticatedUser,
  ): Promise<CheckinResponse> {
    return this.checkinsService.update(id, dto, user.id, user.role);
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @User() user: AuthenticatedUser,
  ): Promise<DeleteResponse> {
    await this.checkinsService.remove(id, user.id, user.role);
    return { deleted: true };
  }
}
