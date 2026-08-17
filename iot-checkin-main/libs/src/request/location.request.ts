export interface WorkScheduleDay {
  enabled: boolean;
  startTime: string;
  endTime: string;
}

export type WorkSchedule = Record<number, WorkScheduleDay>;

export interface CreateLocationRequest {
  name: string;
  address?: string;
  lat: number;
  lng: number;
  startTime?: string;
  endTime?: string;
  freeAccessEnabled?: boolean;
  freeAccessStartTime?: string | null;
  freeAccessEndTime?: string | null;
  workSchedule?: WorkSchedule;
}

export interface UpdateLocationRequest {
  name?: string;
  address?: string;
  lat?: number;
  lng?: number;
  startTime?: string;
  endTime?: string;
  freeAccessEnabled?: boolean;
  freeAccessStartTime?: string | null;
  freeAccessEndTime?: string | null;
  workSchedule?: WorkSchedule;
}

export interface AddUserToLocationRequest {
  userId: string;
}

export interface JoinLocationRequest {
  code: string;
}
