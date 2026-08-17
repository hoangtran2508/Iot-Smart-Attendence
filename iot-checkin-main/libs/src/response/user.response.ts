import { IsoDateString } from './base';
import type { UserRole } from '../shared';

export interface UserResponse {
	id: string;
	name: string;
	email: string;
	phoneNumber?: string | null;
	role: UserRole;
	fingerprintIds?: number[];
	fingerprints?: { fingerId: number; deviceId: string }[];
	createdAt: IsoDateString;
	updatedAt: IsoDateString;
}
