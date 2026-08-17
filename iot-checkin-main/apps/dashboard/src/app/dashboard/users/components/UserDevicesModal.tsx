import { useState, useEffect } from 'react';
import { api } from '../../../../lib/api';
import { X, Smartphone, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

interface DeviceData {
  id: string;
  deviceUuid: string;
  macAddress: string | null;
  createdAt: string;
}

interface UserDevicesModalProps {
  userId: string;
  userName: string;
  onClose: () => void;
}

export function UserDevicesModal({ userId, userName, onClose }: UserDevicesModalProps) {
  const [devices, setDevices] = useState<DeviceData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDevices();
  }, [userId]);

  const fetchDevices = async () => {
    setIsLoading(true);
    try {
      const response = await api.get(`/users/${userId}/devices`);
      setDevices(response.data);
      setError('');
    } catch (err: any) {
      console.error('Failed to fetch user devices', err);
      setError(err.response?.data?.message || 'Failed to load devices.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (deviceId: string) => {
    if (!window.confirm('Are you sure you want to unbind this device? The user will need to re-register on their next check-in.')) {
      return;
    }
    try {
      await api.delete(`/users/${userId}/devices/${deviceId}`);
      fetchDevices();
    } catch (err: any) {
      console.error('Failed to delete device', err);
      alert(err.response?.data?.message || 'Failed to unbind device.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-800">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-emerald-400" />
              Registered Devices
            </h2>
            <p className="text-sm text-zinc-400 mt-1">Viewing devices for {userName}</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center p-8">
              <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm text-center">
              {error}
            </div>
          ) : devices.length === 0 ? (
            <div className="text-center p-8 border border-dashed border-zinc-700 rounded-xl bg-zinc-950">
              <Smartphone className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-400 font-medium">No devices registered</p>
              <p className="text-zinc-500 text-sm mt-1">This user hasn't checked in with any device yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {devices.map(device => (
                <div key={device.id} className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 flex items-center justify-between group hover:border-zinc-700 transition-colors">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white font-mono bg-zinc-800 px-2 py-0.5 rounded">
                        {device.deviceUuid.split('-')[0]}...
                      </span>
                      <span className="text-xs text-zinc-500">UUID</span>
                    </div>
                    {device.macAddress && (
                      <div className="text-xs text-zinc-400 mt-2 font-mono">
                        MAC: {device.macAddress}
                      </div>
                    )}
                    <div className="text-xs text-zinc-500 mt-1">
                      Registered: {format(new Date(device.createdAt), 'MMM d, yyyy HH:mm')}
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleDelete(device.id)}
                    className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                    title="Unbind Device"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
