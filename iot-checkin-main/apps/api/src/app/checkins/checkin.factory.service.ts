import { Injectable } from '@nestjs/common';
import { CheckinResponse, LocationResponse, UserResponse } from 'libs';
import { CheckIn } from '../../entities/checkin.entity';
import { Location } from '../../entities/location.entity';
import { User } from '../../entities/user.entity';

@Injectable()
export class CheckinFactoryService {
  toCheckinResponse(checkin: CheckIn): CheckinResponse {
    const response: CheckinResponse = {
      id: checkin.id,
      userId: checkin.userId,
      locationId: checkin.locationId,
      checkedInAt: checkin.checkedInAt.toISOString(),
      note: checkin.note ?? null,
      status: checkin.status,
      direction: checkin.direction,
      createdAt: checkin.createdAt.toISOString(),
    };

    if (checkin.user) {
      response.user = this.toUserResponse(checkin.user);
    }

    if (checkin.location) {
      response.location = this.toLocationResponse(checkin.location);
    }

    return response;
  }

  toUserResponse(user: User): UserResponse {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  toLocationResponse(location: Location): LocationResponse {
    return {
      id: location.id,
      name: location.name,
      address: location.address ?? null,
      lat: location.lat,
      lng: location.lng,
      createdAt: location.createdAt.toISOString(),
      updatedAt: location.updatedAt.toISOString(),
    };
  }
}
