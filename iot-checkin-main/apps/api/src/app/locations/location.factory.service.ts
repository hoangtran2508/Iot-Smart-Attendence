import { Injectable } from '@nestjs/common';
import { LocationResponse } from 'libs';
import { Location } from '../../entities/location.entity';

@Injectable()
export class LocationFactoryService {
  toLocationResponse(location: Location): LocationResponse {
    return {
      id: location.id,
      name: location.name,
      address: location.address ?? null,
      lat: location.lat,
      lng: location.lng,
      adminId: location.admin?.id ?? null,
      joinCode: location.joinCode,
      startTime: location.startTime,
      endTime: location.endTime,
      freeAccessEnabled: location.freeAccessEnabled,
      freeAccessStartTime: location.freeAccessStartTime ?? null,
      freeAccessEndTime: location.freeAccessEndTime ?? null,
      workSchedule: location.workSchedule ?? null,
      users: location.users?.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phoneNumber: u.phoneNumber ?? null,
        role: u.role,
        fingerprintIds: location.fingerprints?.filter(f => f.userId === u.id).map(f => f.fingerId) || [],
        fingerprints: location.fingerprints?.filter(f => f.userId === u.id).map(f => ({
          fingerId: f.fingerId,
          deviceId: f.deviceId
        })) || [],
        createdAt: u.createdAt.toISOString(),
        updatedAt: u.updatedAt.toISOString(),
      })),
      devices: location.devices?.map(d => {
        const isOnline = d.lastSeenAt ? (Date.now() - d.lastSeenAt.getTime() < 120000) : false;
        return {
          id: d.id,
          clientId: d.clientId,
          name: d.name ?? null,
          locationId: d.locationId,
          ipAddress: d.ipAddress ?? null,
          lastSeenAt: d.lastSeenAt?.toISOString() ?? null,
          isOnline,
          createdAt: d.createdAt.toISOString(),
          updatedAt: d.updatedAt.toISOString(),
        };
      }),
      createdAt: location.createdAt.toISOString(),
      updatedAt: location.updatedAt.toISOString(),
    };
  }
}
