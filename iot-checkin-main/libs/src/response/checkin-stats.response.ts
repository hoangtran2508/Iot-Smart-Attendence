export interface CheckinStatsDaily {
  userId: string;
  userName: string;
  userEmail: string;
  date: string; // YYYY-MM-DD
  firstIn: string | null; // ISO Date String
  lastOut: string | null; // ISO Date String
  workingHours: number;
  status: 'success' | 'late' | 'missing_data' | 'fraud';
}

export interface CheckinStatsSummary {
  userId: string;
  userName: string;
  userEmail: string;
  totalWorkingDays: number;
  totalWorkingHours: number;
  lateCount: number;
  fraudCount: number;
  missingDataCount: number;
}

export interface CheckinStatsResponse {
  summary: CheckinStatsSummary[];
  detailed: CheckinStatsDaily[];
}
