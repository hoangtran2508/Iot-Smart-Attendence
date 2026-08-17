import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { CreateDeviceRequest, DeleteResponse, DeviceResponse } from 'libs';
import { DevicesService } from './devices.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { User } from '../auth/user.decorator';

@Controller('locations/:locationId/devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post()
  addDevice(
    @Param('locationId') locationId: string,
    @Body() dto: CreateDeviceRequest,
    @User() user: AuthenticatedUser,
  ): Promise<DeviceResponse> {
    return this.devicesService.addDevice(locationId, dto, user.id, user.role);
  }

  @Get()
  findByLocation(
    @Param('locationId') locationId: string,
  ): Promise<DeviceResponse[]> {
    return this.devicesService.findByLocation(locationId);
  }

  @Delete(':deviceId')
  async removeDevice(
    @Param('locationId') locationId: string,
    @Param('deviceId') deviceId: string,
    @User() user: AuthenticatedUser,
  ): Promise<DeleteResponse> {
    await this.devicesService.removeDevice(locationId, deviceId, user.id, user.role);
    return { deleted: true };
  }

  @Post(':deviceId/command')
  async publishDeviceCommand(
    @Param('locationId') locationId: string,
    @Param('deviceId') deviceId: string,
    @Body('command') command: string,
    @Body('fingerId') fingerId: number | undefined,
    @User() user: AuthenticatedUser,
  ) {
    return this.devicesService.publishDeviceCommand(
      locationId,
      deviceId,
      command,
      fingerId,
      user.id,
      user.role,
    );
  }

  @Get('scan-reports')
  async getScanReports(
    @Param('locationId') locationId: string,
    @User() user: AuthenticatedUser,
  ) {
    return this.devicesService.getScanReports(locationId, user.id, user.role);
  }

  @Get('presence')
  async checkPresence(
    @Param('locationId') locationId: string,
    @User() user: AuthenticatedUser,
  ) {
    return this.devicesService.checkPresence(locationId, user.id);
  }
}
