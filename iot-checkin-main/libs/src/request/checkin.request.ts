export interface CreateCheckinRequest {
  userId?: string; // For Admin to check-in someone else
  locationId: string;
  checkedInAt?: string;
  note?: string;
}

export interface UpdateCheckinRequest {
  checkedInAt?: string;
  note?: string;
}

export interface WifiCheckinRequest {
  key: string;
  deviceId: string;  // ESP device identifier (MAC-based)
  locationId: string;
  deviceUuid: string; // Mobile device unique identifier (Anti-fraud)
  mac?: string;      // Phone MAC address (optional, for presence check)
  rssi?: number;     // WiFi signal strength (optional)
  direction?: string; // "in" or "out" from IR sensor
}
