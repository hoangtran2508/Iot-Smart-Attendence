import { IsoDateString } from './base';
import type { DeviceResponse } from './device.response';
import type { UserResponse } from './user.response';
import type { WorkSchedule } from '../request/location.request';

export interface LocationResponse {
	id: string;
	name: string;
	address?: string | null;
	lat: number;
	lng: number;
	adminId?: string | null;
	joinCode?: string;
	startTime?: string;
	endTime?: string;
	freeAccessEnabled?: boolean;
	freeAccessStartTime?: string | null;
	freeAccessEndTime?: string | null;
	workSchedule?: WorkSchedule | null;
	users?: UserResponse[];
	devices?: DeviceResponse[];
	createdAt: IsoDateString;
	updatedAt: IsoDateString;
}
