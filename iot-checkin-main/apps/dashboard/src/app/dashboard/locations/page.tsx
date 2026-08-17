"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { api } from '../../../lib/api';
import { MapPin, Plus, Edit2, Trash2, Users } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { WorkSchedule } from 'libs';

const DEFAULT_SCHEDULE: WorkSchedule = {
  1: { enabled: true, startTime: '08:00', endTime: '17:00' }, // Mon
  2: { enabled: true, startTime: '08:00', endTime: '17:00' }, // Tue
  3: { enabled: true, startTime: '08:00', endTime: '17:00' }, // Wed
  4: { enabled: true, startTime: '08:00', endTime: '17:00' }, // Thu
  5: { enabled: true, startTime: '08:00', endTime: '17:00' }, // Fri
  6: { enabled: false, startTime: '08:00', endTime: '17:00' }, // Sat
  0: { enabled: false, startTime: '08:00', endTime: '17:00' }, // Sun
};

interface Location {
  id: string;
  name: string;
  address?: string | null;
  lat: number;
  lng: number;
  joinCode?: string;
  adminId?: string | null;
  startTime?: string;
  endTime?: string;
  freeAccessEnabled?: boolean;
  freeAccessStartTime?: string | null;
  freeAccessEndTime?: string | null;
  workSchedule?: WorkSchedule | null;
  createdAt: string;
}

export default function LocationsPage() {
  const { user } = useAuth();
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<Partial<Location> | null>(null);

  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    try {
      const response = await api.get('/locations');
      setLocations(response.data);
    } catch (error) {
      console.error('Failed to fetch locations', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (currentLocation?.id) {
        await api.patch(`/locations/${currentLocation.id}`, currentLocation);
      } else {
        await api.post('/locations', currentLocation);
      }
      setIsModalOpen(false);
      setCurrentLocation(null);
      fetchLocations();
    } catch (error) {
      console.error('Failed to save location', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this location?')) {
      try {
        await api.delete(`/locations/${id}`);
        fetchLocations();
      } catch (error) {
        console.error('Failed to delete location', error);
      }
    }
  };

  const renderScheduleSummary = (schedule: WorkSchedule | null | undefined) => {
    if (!schedule) return '08:00 - 17:00';
    
    // Count how many days are enabled
    const enabledDays = Object.entries(schedule).filter(([_, s]) => s.enabled);
    if (enabledDays.length === 0) return 'No working days';

    const firstActive = enabledDays[0][1];
    const allSameTime = enabledDays.every(([_, s]) => s.startTime === firstActive.startTime && s.endTime === firstActive.endTime);

    if (allSameTime) {
      const dayNames = enabledDays.map(([key]) => {
        const dayNum = parseInt(key);
        if (dayNum === 1) return 'Mon';
        if (dayNum === 2) return 'Tue';
        if (dayNum === 3) return 'Wed';
        if (dayNum === 4) return 'Thu';
        if (dayNum === 5) return 'Fri';
        if (dayNum === 6) return 'Sat';
        return 'Sun';
      });

      const hasMon = schedule[1]?.enabled;
      const hasTue = schedule[2]?.enabled;
      const hasWed = schedule[3]?.enabled;
      const hasThu = schedule[4]?.enabled;
      const hasFri = schedule[5]?.enabled;
      const hasSat = schedule[6]?.enabled;
      const hasSun = schedule[0]?.enabled;

      if (hasMon && hasTue && hasWed && hasThu && hasFri && !hasSat && !hasSun) {
        return `Mon-Fri: ${firstActive.startTime} - ${firstActive.endTime}`;
      }

      return `${dayNames.join(', ')}: ${firstActive.startTime} - ${firstActive.endTime}`;
    }

    return 'Flexible Schedule';
  };

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <MapPin className="text-emerald-400" />
            Locations
          </h1>
          <p className="text-zinc-400 mt-1">Manage all physical check-in locations.</p>
        </div>
        <button
          onClick={() => {
            setCurrentLocation({ 
              name: '', address: '', lat: 0, lng: 0, startTime: '08:00', endTime: '17:00', 
              workSchedule: DEFAULT_SCHEDULE, freeAccessEnabled: false, freeAccessStartTime: '12:00', freeAccessEndTime: '13:00' 
            });
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors shadow-lg shadow-emerald-500/20"
        >
          <Plus className="w-4 h-4" />
          Add Location
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400 bg-zinc-900/50">
                  <th className="p-4 font-medium">Name</th>
                  <th className="p-4 font-medium">Address</th>
                  <th className="p-4 font-medium">Coordinates</th>
                  <th className="p-4 font-medium">Work Hours</th>
                  <th className="p-4 font-medium">Join Code</th>
                  <th className="p-4 font-medium">Created</th>
                  <th className="p-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {locations.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-zinc-500">
                      No locations found. Add your first location to get started.
                    </td>
                  </tr>
                ) : (
                  locations.map((location) => (
                    <tr key={location.id} className="hover:bg-zinc-800/50 transition-colors">
                      <td className="p-4 font-medium text-white flex items-center gap-2">
                        {location.name}
                        {location.adminId === user.id ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                            Owner
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">
                            Member
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-zinc-400">{location.address || '-'}</td>
                      <td className="p-4 text-zinc-400 text-sm">
                        {location.lat}, {location.lng}
                      </td>
                      <td className="p-4 text-zinc-400 text-sm">
                        {renderScheduleSummary(location.workSchedule)}
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {location.joinCode || '-'}
                        </span>
                      </td>
                      <td className="p-4 text-zinc-400 text-sm">
                        {format(new Date(location.createdAt), 'MMM d, yyyy')}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2">
                          {(location.adminId === user.id || user.role === 'admin') ? (
                            <>
                              <Link
                                href={`/dashboard/locations/${location.id}`}
                                className="p-2 text-zinc-400 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors"
                                title="Manage Users"
                              >
                                <Users className="w-4 h-4" />
                              </Link>
                              <button
                                onClick={() => {
                                  setCurrentLocation({
                                    ...location,
                                    workSchedule: location.workSchedule || DEFAULT_SCHEDULE
                                  });
                                  setIsModalOpen(true);
                                }}
                                className="p-2 text-zinc-400 hover:text-emerald-400 hover:bg-emerald-400/10 rounded-lg transition-colors"
                                title="Edit"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(location.id)}
                                className="p-2 text-zinc-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <span className="text-xs text-zinc-500 italic px-2 py-1">Member</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-zinc-800">
              <h2 className="text-xl font-bold text-white">
                {currentLocation?.id ? 'Edit Location' : 'Add Location'}
              </h2>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Name</label>
                <input
                  required
                  type="text"
                  value={currentLocation?.name || ''}
                  onChange={(e) => setCurrentLocation({ ...currentLocation, name: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                  placeholder="e.g. Headquarters"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Address</label>
                <input
                  type="text"
                  value={currentLocation?.address || ''}
                  onChange={(e) => setCurrentLocation({ ...currentLocation, address: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                  placeholder="123 Main St"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Latitude</label>
                  <input
                    required
                    type="number"
                    step="any"
                    value={currentLocation?.lat || ''}
                    onChange={(e) => setCurrentLocation({ ...currentLocation, lat: parseFloat(e.target.value) })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                    placeholder="37.7749"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Longitude</label>
                  <input
                    required
                    type="number"
                    step="any"
                    value={currentLocation?.lng || ''}
                    onChange={(e) => setCurrentLocation({ ...currentLocation, lng: parseFloat(e.target.value) })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                    placeholder="-122.4194"
                  />
                </div>
              </div>
              <div className="border-t border-zinc-800 pt-4">
                <label className="block text-sm font-medium text-zinc-400 mb-2">Work Schedule (Lịch làm việc)</label>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {[
                    { key: 1, label: 'Thứ 2 (Mon)' },
                    { key: 2, label: 'Thứ 3 (Tue)' },
                    { key: 3, label: 'Thứ 4 (Wed)' },
                    { key: 4, label: 'Thứ 5 (Thu)' },
                    { key: 5, label: 'Thứ 6 (Fri)' },
                    { key: 6, label: 'Thứ 7 (Sat)' },
                    { key: 0, label: 'Chủ nhật (Sun)' },
                  ].map((day) => {
                    const daySched = currentLocation?.workSchedule?.[day.key] || { enabled: false, startTime: '08:00', endTime: '17:00' };
                    return (
                      <div key={day.key} className="flex items-center justify-between bg-zinc-950/40 p-2 rounded-lg border border-zinc-800/60 gap-3">
                        <label className="flex items-center gap-2 text-sm text-white font-medium min-w-[110px] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={daySched.enabled}
                            onChange={(e) => {
                              const updatedSched = {
                                ...currentLocation?.workSchedule,
                                [day.key]: { ...daySched, enabled: e.target.checked }
                              };
                              setCurrentLocation({ ...currentLocation, workSchedule: updatedSched });
                            }}
                            className="w-4 h-4 rounded border-zinc-700 text-emerald-500 focus:ring-emerald-500 bg-zinc-900"
                          />
                          {day.label}
                        </label>
                        <div className="flex items-center gap-2 flex-1 justify-end">
                          <input
                            disabled={!daySched.enabled}
                            type="time"
                            value={daySched.startTime}
                            onChange={(e) => {
                              const updatedSched = {
                                ...currentLocation?.workSchedule,
                                [day.key]: { ...daySched, startTime: e.target.value }
                              };
                              setCurrentLocation({ ...currentLocation, workSchedule: updatedSched });
                            }}
                            className="bg-zinc-900 border border-zinc-800 disabled:opacity-40 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                          <span className="text-zinc-500 text-xs">-</span>
                          <input
                            disabled={!daySched.enabled}
                            type="time"
                            value={daySched.endTime}
                            onChange={(e) => {
                              const updatedSched = {
                                ...currentLocation?.workSchedule,
                                [day.key]: { ...daySched, endTime: e.target.value }
                              };
                              setCurrentLocation({ ...currentLocation, workSchedule: updatedSched });
                            }}
                            className="bg-zinc-900 border border-zinc-800 disabled:opacity-40 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-zinc-800 pt-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-400">Enable Free Access</label>
                    <p className="text-xs text-zinc-500 mt-1">Automatically open door during specific hours</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={currentLocation?.freeAccessEnabled || false}
                      onChange={(e) => setCurrentLocation({ ...currentLocation, freeAccessEnabled: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>

                {currentLocation?.freeAccessEnabled && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-zinc-400 mb-1">Start Time</label>
                      <input
                        type="time"
                        value={currentLocation?.freeAccessStartTime || ''}
                        onChange={(e) => setCurrentLocation({ ...currentLocation, freeAccessStartTime: e.target.value })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-400 mb-1">End Time</label>
                      <input
                        type="time"
                        value={currentLocation?.freeAccessEndTime || ''}
                        onChange={(e) => setCurrentLocation({ ...currentLocation, freeAccessEndTime: e.target.value })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                      />
                    </div>
                  </div>
                )}
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-zinc-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors shadow-lg shadow-emerald-500/20"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
