"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../lib/api';
import {
  ArrowLeft,
  UserMinus,
  Plus,
  Fingerprint,
  Trash2,
  Cpu,
  Wifi,
  Unlock,
  ShieldAlert,
  X,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '../../../../context/AuthContext';
import { WorkSchedule } from 'libs';

interface User {
  id: string;
  name: string;
  email: string;
  fingerprintIds?: number[];
  fingerprints?: { fingerId: number; deviceId: string }[];
}

interface Device {
  id: string;
  clientId: string;
  name: string | null;
  ipAddress: string | null;
  lastSeenAt: string | null;
  isOnline: boolean;
}

interface Location {
  id: string;
  name: string;
  adminId: string | null;
  joinCode?: string;
  workSchedule?: WorkSchedule | null;
  users?: User[];
  devices?: Device[];
}

export default function LocationUsersPage() {
  const params = useParams();
  const router = useRouter();
  const locationId = params.id as string;
  
  const { user: currentUser } = useAuth();
  const [location, setLocation] = useState<Location | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Add Device State
  const [isAddingDevice, setIsAddingDevice] = useState(false);
  const [newDeviceClientId, setNewDeviceClientId] = useState('');
  const [newDeviceName, setNewDeviceName] = useState('');
  const [deviceError, setDeviceError] = useState('');

  // Enroll State
  const [enrollingUser, setEnrollingUser] = useState<{ id: string; name: string } | null>(null);
  const [enrollStatus, setEnrollStatus] = useState<'none' | 'pending' | 'success' | 'failed' | 'expired'>('none');
  const [enrollError, setEnrollError] = useState('');
  const [enrollFingerId, setEnrollFingerId] = useState<number | null>(null);

  // WiFi Check-in State
  const [wifiCheckinStatus, setWifiCheckinStatus] = useState<{ status: 'idle' | 'checking' | 'success' | 'failed'; message?: string }>({ status: 'idle' });

  // Scan Reports State
  interface ScanReport {
    id: string;
    macs: string[];
    createdAt: string;
    device: {
      id: string;
      name: string | null;
      clientId: string;
    };
  }
  const [scanReports, setScanReports] = useState<ScanReport[]>([]);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [checkins, setCheckins] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
    
    // Check URL params for WiFi Checkin return status
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get('status');
    const message = urlParams.get('message');
    if (status === 'success') {
      window.alert('Check-in request sent! Please pass through the door.');
      window.history.replaceState(null, '', window.location.pathname);
    } else if (status === 'error') {
      window.alert('Check-in failed: ' + (message || 'Please block IR sensor first'));
      window.history.replaceState(null, '', window.location.pathname);
    }

    // Poll location and scan reports every 10s for live IP/online status updates
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [locationId]);

  const getDeviceUuid = () => {
    let uuid = localStorage.getItem('iot_checkin_device_uuid');
    if (!uuid) {
      uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
      localStorage.setItem('iot_checkin_device_uuid', uuid);
    }
    return uuid;
  };

  // Handle polling for fingerprint enrollment status
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (enrollingUser && enrollStatus === 'pending') {
      interval = setInterval(async () => {
        try {
          const res = await api.get(`/locations/${locationId}/fingerprints/enroll-status/${enrollingUser.id}`);
          const { status, fingerId, error } = res.data;
          if (status === 'success') {
            setEnrollStatus('success');
            setEnrollFingerId(fingerId);
            fetchData();
            clearInterval(interval);
          } else if (status === 'failed') {
            setEnrollStatus('failed');
            setEnrollError(error || 'Enrollment failed on device');
            clearInterval(interval);
          } else if (status === 'expired') {
            setEnrollStatus('expired');
            clearInterval(interval);
          }
        } catch (err) {
          console.error('Failed to fetch enroll status', err);
        }
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [enrollingUser, enrollStatus]);

  const fetchData = async () => {
    try {
      const locationRes = await api.get(`/locations/${locationId}`);
      setLocation(locationRes.data);
      
      const checkinsRes = await api.get('/checkins');
      setCheckins(checkinsRes.data);
      
      const isAdmin = currentUser?.role === 'admin' || currentUser?.id === locationRes.data.adminId;
      if (isAdmin) {
        const reportsRes = await api.get(`/locations/${locationId}/devices/scan-reports`);
        setScanReports(reportsRes.data);
      }
    } catch (error) {
      console.error('Failed to fetch data', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchScanReports = async () => {
    try {
      const reportsRes = await api.get(`/locations/${locationId}/devices/scan-reports`);
      setScanReports(reportsRes.data);
    } catch (error) {
      console.error('Failed to fetch scan reports', error);
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (window.confirm('Remove this user from the location?')) {
      try {
        await api.delete(`/locations/${locationId}/users/${userId}`);
        fetchData();
      } catch (error) {
        console.error('Failed to remove user', error);
      }
    }
  };

  const handleAddDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeviceError('');
    try {
      await api.post(`/locations/${locationId}/devices`, {
        clientId: newDeviceClientId,
        name: newDeviceName || undefined,
      });
      setIsAddingDevice(false);
      setNewDeviceClientId('');
      setNewDeviceName('');
      fetchData();
    } catch (error: any) {
      console.error('Failed to add device', error);
      setDeviceError(error.response?.data?.message || 'Failed to add device');
    }
  };

  const handleRemoveDevice = async (deviceId: string) => {
    if (window.confirm('Remove this device?')) {
      try {
        await api.delete(`/locations/${locationId}/devices/${deviceId}`);
        fetchData();
      } catch (error) {
        console.error('Failed to remove device', error);
      }
    }
  };

  const handleRequestEnrollForUser = async (userId: string, userName: string) => {
    try {
      setEnrollingUser({ id: userId, name: userName });
      setEnrollStatus('pending');
      setEnrollError('');
      setEnrollFingerId(null);
      await api.post(`/locations/${locationId}/fingerprints/request-enroll`, { userId });
    } catch (error: any) {
      console.error('Failed to request enrollment for user', error);
      alert(error.response?.data?.message || 'Enrollment request failed');
      setEnrollingUser(null);
      setEnrollStatus('none');
    }
  };

  const handleCloseEnrollModal = async () => {
    if (enrollingUser) {
      try {
        await api.delete(`/locations/${locationId}/fingerprints/enroll-status/${enrollingUser.id}`);
      } catch (err) {
        console.error('Failed to clear enroll status', err);
      }
      setEnrollingUser(null);
      setEnrollStatus('none');
    }
  };

  const handleWifiCheckin = async (device: Device) => {
    if (!device.ipAddress) return;
    setWifiCheckinStatus({ status: 'checking' });
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) throw new Error('Not authenticated');
      
      const deviceUuid = getDeviceUuid();
      const callbackUrl = encodeURIComponent(window.location.origin + window.location.pathname);
      
      // Redirect to ESP local server to bypass Mixed Content Blockers
      window.location.href = `http://${device.ipAddress}/checkin?token=${token}&deviceUuid=${deviceUuid}&redirect=${callbackUrl}`;
      
    } catch (err: any) {
      console.error(err);
      setWifiCheckinStatus({ 
        status: 'failed', 
        message: err.message || 'Connection to ESP device failed.' 
      });
      setTimeout(() => setWifiCheckinStatus({ status: 'idle' }), 5000);
    }
  };

  const handleDeviceCommand = async (deviceId: string, command: string, fingerId?: number) => {
    try {
      await api.post(`/locations/${locationId}/devices/${deviceId}/command`, {
        command,
        fingerId,
      });
      alert(`Command '${command}' sent successfully!`);
    } catch (error: any) {
      console.error('Failed to execute command', error);
      alert(error.response?.data?.message || 'Failed to execute command');
    }
  };

  const handleDeleteFingerprint = async (deviceId: string, fingerId: number, userName: string) => {
    if (window.confirm(`Xóa vân tay ID ${fingerId} của ${userName} trên thiết bị này?`)) {
      try {
        await api.post(`/locations/${locationId}/devices/${deviceId}/command`, {
          command: 'delete_finger',
          fingerId,
        });
        alert(`Đã gửi lệnh xóa vân tay ID ${fingerId} tới thiết bị.`);
      } catch (error: any) {
        console.error('Failed to delete fingerprint', error);
        alert(error.response?.data?.message || 'Failed to delete fingerprint');
      }
    }
  };

  const getUserTodayStatus = (userId: string) => {
    const now = new Date();
    const dayName = now.toLocaleDateString('en-US', { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'long' });
    const dayMap: Record<string, number> = {
      Sunday: 0,
      Monday: 1,
      Tuesday: 2,
      Wednesday: 3,
      Thursday: 4,
      Friday: 5,
      Saturday: 6,
    };
    const dayOfWeek = dayMap[dayName];

    let isEnabled = true;
    if (location && location.workSchedule && location.workSchedule[dayOfWeek]) {
      isEnabled = location.workSchedule[dayOfWeek].enabled;
    } else {
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        isEnabled = false;
      }
    }

    if (!isEnabled) {
      return 'off_day';
    }

    const todayStr = now.toLocaleDateString('en-US', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    
    // Find all check-ins for this user today at this location
    const todayCheckins = checkins.filter(c => {
      if (c.userId !== userId || c.locationId !== locationId) return false;
      const checkinDate = new Date(c.checkedInAt);
      const itemDateStr = checkinDate.toLocaleDateString('en-US', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      return itemDateStr === todayStr;
    });

    if (todayCheckins.length === 0) return 'absent';
    // If they have any success check-in today, they are considered success (đúng giờ)
    const hasSuccess = todayCheckins.some(c => c.status === 'success');
    return hasSuccess ? 'success' : 'late';
  };

  const renderStatusBadge = (status: 'success' | 'late' | 'absent' | 'off_day') => {
    switch (status) {
      case 'success':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Đúng giờ
          </span>
        );
      case 'late':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            Muộn
          </span>
        );
      case 'absent':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500/10 text-red-400 border border-red-500/20">
            Nghỉ
          </span>
        );
      case 'off_day':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-800 text-zinc-500 border border-zinc-700">
            Không yêu cầu
          </span>
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!location) {
    return <div className="text-red-400">Location not found.</div>;
  }

  const isAdmin = currentUser?.role === 'admin' || currentUser?.id === location.adminId;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <Link href="/dashboard/locations" className="inline-flex items-center text-sm font-medium text-emerald-400 hover:text-emerald-300 mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Locations
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">
              {location.name}
            </h1>
            <p className="text-zinc-400 mt-1">Manage access and hardware devices for this location.</p>
          </div>
        </div>
      </div>



      {location.joinCode && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
          <div>
            <h3 className="font-semibold text-white">Join Code</h3>
            <p className="text-sm text-zinc-400 mt-1">Share this code with members so they can join this location.</p>
          </div>
          <div className="bg-zinc-950 border border-zinc-800 px-6 py-3 rounded-xl">
            <span className="text-xl font-mono font-bold tracking-[0.2em] text-emerald-400">
              {location.joinCode}
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl flex flex-col h-[500px]">
          <div className="p-4 border-b border-zinc-800 bg-zinc-900/50">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-semibold text-white">Assigned Users</h2>
              <span className="text-xs font-medium bg-zinc-800 text-zinc-300 px-2 py-1 rounded-full">
                {location.users?.length || 0}
              </span>
            </div>
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>
          {(!location.users || location.users.length === 0) ? (
            <div className="p-8 text-center text-zinc-500">
              No users assigned.
            </div>
          ) : (
            <div className="overflow-y-auto flex-1 custom-scrollbar">
              <ul className="divide-y divide-zinc-800">
                {location.users
                  .filter(u => 
                    u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                    u.email.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map((u) => {
                    const todayStatus = getUserTodayStatus(u.id);
                    return (
                      <li key={u.id} className="flex items-center justify-between hover:bg-zinc-800/50 transition-colors cursor-pointer group">
                        <div 
                          className="flex-1 p-4" 
                          onClick={() => router.push(`/dashboard/checkins?filterUser=${u.email}&filterLocation=${location.name}`)}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-white group-hover:text-emerald-400 transition-colors">{u.name}</p>
                              <p className="text-sm text-zinc-400">{u.email}</p>
                            </div>
                            <div className="mt-1">
                              {renderStatusBadge(todayStatus)}
                            </div>
                          </div>
                          {u.fingerprints && u.fingerprints.length > 0 ? (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {u.fingerprints.map(f => {
                                const deviceName = location.devices?.find(d => d.id === f.deviceId)?.name || 'Device';
                                return (
                                  <span
                                    key={`${f.deviceId}-${f.fingerId}`}
                                    className="inline-flex items-center pl-2 pr-1 py-0.5 rounded text-[10px] font-medium font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 group/badge"
                                  >
                                    ID: {f.fingerId} ({deviceName})
                                    {isAdmin && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteFingerprint(f.deviceId, f.fingerId, u.name);
                                        }}
                                        className="ml-1.5 p-0.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                                        title="Delete this fingerprint"
                                      >
                                        <X className="w-2.5 h-2.5" />
                                      </button>
                                    )}
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            u.fingerprintIds && u.fingerprintIds.length > 0 && (
                              <div className="flex flex-wrap gap-2 mt-2">
                                {u.fingerprintIds.map(fid => (
                                  <span key={fid} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    ID: {fid}
                                  </span>
                                ))}
                              </div>
                            )
                          )}
                        </div>
                        {isAdmin && (
                          <div className="flex items-center p-2 mr-2 space-x-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleRequestEnrollForUser(u.id, u.name); }}
                              className="p-2 text-zinc-400 hover:text-emerald-400 hover:bg-emerald-400/10 rounded-lg transition-colors"
                              title="Enroll fingerprint for this user"
                            >
                              <Fingerprint className="w-4 h-4" />
                            </button>
                            {u.id !== currentUser?.id && (
                              <button
                                onClick={() => handleRemoveUser(u.id)}
                                className="p-2 text-zinc-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                                title="Remove user"
                              >
                                <UserMinus className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                {location.users.filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase()) || u.email.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                   <li className="p-8 text-center text-zinc-500">No users match your search.</li>
                )}
              </ul>
            </div>
          )}
        </div>

        {/* DEVICES LIST */}
        {isAdmin && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl flex flex-col">
            <div className="p-4 border-b border-zinc-800 bg-zinc-900/50 flex justify-between items-center">
              <div className="flex items-center">
                <Cpu className="w-4 h-4 mr-2 text-emerald-400" />
                <h2 className="font-semibold text-white">Hardware Devices</h2>
              </div>
              {!isAddingDevice && (
                <button
                  onClick={() => setIsAddingDevice(true)}
                  className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
                  title="Add Device"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>

            {isAddingDevice && (
              <form onSubmit={handleAddDevice} className="p-4 bg-zinc-900/80 border-b border-zinc-800">
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">Device MAC / Client ID *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. esp_AABBCCDDEEFF"
                      value={newDeviceClientId}
                      onChange={(e) => setNewDeviceClientId(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">Friendly Name (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Main Gate"
                      value={newDeviceName}
                      onChange={(e) => setNewDeviceName(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  {deviceError && <p className="text-xs text-red-400">{deviceError}</p>}
                  <div className="flex gap-2 pt-1">
                    <button
                      type="submit"
                      className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium py-2 rounded-lg transition-colors"
                    >
                      Add Device
                    </button>
                    <button
                      type="button"
                      onClick={() => { setIsAddingDevice(false); setDeviceError(''); }}
                      className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </form>
            )}

            <div className="flex-1">
              {wifiCheckinStatus.message && (
                <div className={`mx-4 mt-2 p-3 rounded-lg border text-sm ${
                  wifiCheckinStatus.status === 'success' ? 'bg-emerald-950/50 border-emerald-500/30 text-emerald-400' : 'bg-red-950/50 border-red-500/30 text-red-400'
                }`}>
                  {wifiCheckinStatus.message}
                </div>
              )}

              {(!location.devices || location.devices.length === 0) ? (
                <div className="p-8 text-center text-zinc-500">
                  No devices registered for this location.
                </div>
              ) : (
                <ul className="divide-y divide-zinc-800">
                  {location.devices.map((d) => (
                    <li key={d.id} className="p-4 hover:bg-zinc-800/30 transition-colors space-y-2">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-white">{d.name || 'Unnamed Device'}</span>
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                              d.isOnline ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full mr-1 ${d.isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`}></span>
                              {d.isOnline ? 'Online' : 'Offline'}
                            </span>
                            {d.isOnline && d.ipAddress && (
                              <span className="text-xs text-zinc-500 font-mono bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
                                LAN: {d.ipAddress}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-zinc-400 font-mono">{d.clientId}</p>
                          {d.lastSeenAt && (
                            <p className="text-[11px] text-zinc-500">
                              Last seen: {new Date(d.lastSeenAt).toLocaleString()}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {d.isOnline && d.ipAddress && (
                            <button
                              onClick={() => handleWifiCheckin(d)}
                              disabled={wifiCheckinStatus.status === 'checking'}
                              className="inline-flex items-center px-2.5 py-1 text-xs font-semibold bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50 rounded-lg border border-emerald-500/20 transition-all shadow-md active:scale-95 animate-pulse"
                              title="Check in locally via WiFi proximity"
                            >
                              <Wifi className="w-3.5 h-3.5 mr-1" />
                              {wifiCheckinStatus.status === 'checking' ? 'Checking...' : 'WiFi Check-in'}
                            </button>
                          )}
                          <button
                            onClick={() => handleRemoveDevice(d.id)}
                            className="p-2 text-zinc-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                            title="Remove device"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {isAdmin && d.isOnline && (
                        <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-zinc-800/50">
                          <button
                            onClick={() => handleDeviceCommand(d.id, 'open_door')}
                            className="inline-flex items-center px-2.5 py-1 text-[11px] font-medium bg-zinc-800 hover:bg-zinc-750 text-zinc-300 hover:text-emerald-400 rounded-md border border-zinc-700/50 transition-colors"
                            title="Open Door"
                          >
                            <Unlock className="w-3 h-3 mr-1 text-emerald-400" />
                            Open Door
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm('Wipe all fingerprints from this hardware device? This cannot be undone.')) {
                                handleDeviceCommand(d.id, 'delete_all_fingers');
                              }
                            }}
                            className="inline-flex items-center px-2.5 py-1 text-[11px] font-medium bg-red-950/20 hover:bg-red-950/40 text-red-400 hover:text-red-300 rounded-md border border-red-500/20 transition-colors"
                            title="Wipe All Fingerprints"
                          >
                            <ShieldAlert className="w-3 h-3 mr-1" />
                            Wipe All
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      {/* MAC SCAN REPORTS PANEL */}
      {isAdmin && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl p-6 space-y-4">
          <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
            <div className="flex items-center">
              <Wifi className="w-5 h-5 mr-2 text-emerald-400" />
              <div>
                <h3 className="font-semibold text-white">SoftAP MAC Scan Logs</h3>
                <p className="text-xs text-zinc-400">Recent station scan reports from devices scanning local MAC addresses.</p>
              </div>
            </div>
            <button
              onClick={fetchScanReports}
              className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
              title="Refresh Logs"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {scanReports.length === 0 ? (
            <p className="text-sm text-zinc-500 text-center py-8">No scan reports available yet.</p>
          ) : (
            <div className="overflow-x-auto max-h-80 overflow-y-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Device</th>
                    <th className="py-3 px-4">Scanned MACs</th>
                    <th className="py-3 px-4">Active Count</th>
                    <th className="py-3 px-4 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800 text-sm">
                  {scanReports.map((report) => (
                    <tr key={report.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-medium text-white">{report.device.name || 'Device'}</span>
                        <span className="block text-xs text-zinc-500 font-mono">{report.device.clientId}</span>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-zinc-300">
                        <div className="flex flex-wrap gap-1 max-w-lg">
                          {report.macs.map((mac) => (
                            <span key={mac} className="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-400">
                              {mac}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center font-semibold text-emerald-400">
                        {report.macs.length}
                      </td>
                      <td className="py-3 px-4 text-zinc-500 text-xs">
                        {new Date(report.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* LIVE ENROLL MODAL */}
      {enrollingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-6 space-y-6">
            <div className="text-center">
              <Fingerprint className={`w-16 h-16 mx-auto mb-4 ${
                enrollStatus === 'success' ? 'text-emerald-400 animate-pulse' :
                enrollStatus === 'failed' || enrollStatus === 'expired' ? 'text-red-400' : 'text-amber-400 animate-pulse'
              }`} />
              <h3 className="text-lg font-bold text-white">Enroll Fingerprint</h3>
              <p className="text-sm text-zinc-400 mt-1">Registering fingerprint for <strong>{enrollingUser.name}</strong></p>
            </div>

            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-center">
              {enrollStatus === 'pending' && (
                <div className="space-y-2">
                  <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  <p className="text-sm text-amber-400 font-medium">Please place your finger on the sensor</p>
                  <p className="text-xs text-zinc-500">The sensor will scan your fingerprint multiple times to save it.</p>
                </div>
              )}
              {enrollStatus === 'success' && (
                <div className="space-y-1">
                  <p className="text-sm text-emerald-400 font-bold">Successfully Registered!</p>
                  <p className="text-xs text-zinc-400">Fingerprint assigned to slot ID: <span className="font-mono text-white font-semibold">{enrollFingerId}</span></p>
                </div>
              )}
              {enrollStatus === 'failed' && (
                <div className="space-y-1">
                  <p className="text-sm text-red-400 font-semibold">Enrollment Failed</p>
                  <p className="text-xs text-zinc-500">{enrollError}</p>
                </div>
              )}
              {enrollStatus === 'expired' && (
                <div className="space-y-1">
                  <p className="text-sm text-red-400 font-semibold">Request Expired</p>
                  <p className="text-xs text-zinc-500">The enrollment process timed out. Please try again.</p>
                </div>
              )}
            </div>

            <button
              onClick={handleCloseEnrollModal}
              className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-xl transition-colors"
            >
              {enrollStatus === 'success' ? 'Close' : 'Cancel'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
