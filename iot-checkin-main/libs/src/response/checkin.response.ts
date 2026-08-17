import { IsoDateString } from './base';
import { LocationResponse } from './location.response';
import { UserResponse } from './user.response';

export interface CheckinResponse {
  id: string;
  userId: string;
  locationId: string;
  checkedInAt: IsoDateString;
  note?: string | null;
  status?: 'success' | 'late' | 'fraud';
  direction?: 'in' | 'out' | 'unknown';
  createdAt: IsoDateString;
  user?: UserResponse;
  location?: LocationResponse;
}
