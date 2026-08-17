import { IsoDateString } from './base';

export interface DeviceResponse {
  id: string;
  clientId: string;
  name?: string | null;
  locationId: string;
  ipAddress?: string | null;
  lastSeenAt?: IsoDateString | null;
  isOnline: boolean;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}
