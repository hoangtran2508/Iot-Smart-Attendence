import { Injectable } from '@nestjs/common';
import { DeviceResponse } from 'libs';
import { Device } from '../../entities/device.entity';

@Injectable()
export class DeviceFactoryService {
  toDeviceResponse(device: Device): DeviceResponse {
    return {
      id: device.id,
      clientId: device.clientId,
      name: device.name ?? null,
      locationId: device.locationId,
      ipAddress: device.ipAddress ?? null,
      lastSeenAt: device.lastSeenAt ? device.lastSeenAt.toISOString() : null,
      isOnline: device.lastSeenAt ? (Date.now() - device.lastSeenAt.getTime() < 120000) : false,
      createdAt: device.createdAt.toISOString(),
      updatedAt: device.updatedAt.toISOString(),
    };
  }
}
