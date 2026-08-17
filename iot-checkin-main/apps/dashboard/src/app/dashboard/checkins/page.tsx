"use client";

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '../../../context/AuthContext';
import { api } from '../../../lib/api';
import { Activity, Search, Filter, ChevronDown, ChevronRight, MapPin, Calendar, User, Plus } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ManualCheckinModal } from './components/ManualCheckinModal';
import { CheckinStatsResponse } from 'libs';

interface CheckinData {
  id: string;
  checkedInAt: string;
  note?: string;
  status?: 'success' | 'late';
  direction?: 'in' | 'out' | 'unknown';
  user?: { id: string; name: string; email: string };
  location?: { id: string; name: string };
}

interface DateGroup {
  [dateStr: string]: CheckinData[];
}

interface GroupedData {
  [locationId: string]: {
    locationName: string;
    dates: DateGroup;
    totalCount: number;
  };
}

export default function CheckinsPage() {
  const { user } = useAuth();
  const [checkins, setCheckins] = useState<CheckinData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const searchParams = useSearchParams();
  const [filterUser, setFilterUser] = useState(searchParams.get('filterUser') || '');
  const [filterLocation, setFilterLocation] = useState(searchParams.get('filterLocation') || '');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Accordion open states
  const [expandedLocations, setExpandedLocations] = useState<Record<string, boolean>>({});
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});

  const [isManualModalOpen, setIsManualModalOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<'history' | 'stats'>('history');
  const [statsData, setStatsData] = useState<CheckinStatsResponse | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchCheckins();
    } else {
      fetchStats();
    }
  }, [user, activeTab, startDate, endDate, filterLocation]);

  const fetchCheckins = async () => {
    if (!user) return;
    try {
      const response = await api.get('/checkins');
      setCheckins(response.data);
    } catch (error) {
      console.error('Failed to fetch check-ins', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStats = async () => {
    if (!user || !startDate || !endDate) return;
    setIsLoading(true);
    try {
      const response = await api.get('/checkins-stats', {
        params: {
          startDate,
          endDate,
          locationId: filterLocation || undefined
        }
      });
      setStatsData(response.data);
    } catch (error) {
      console.error('Failed to fetch check-in stats', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async () => {
    if (!startDate || !endDate) return;
    setIsExporting(true);
    try {
      const response = await api.get('/checkins-stats/export', {
        params: {
          startDate,
          endDate,
          locationId: filterLocation || undefined
        },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Checkin_Stats_${startDate}_${endDate}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Failed to export', error);
    } finally {
      setIsExporting(false);
    }
  };

  const filteredCheckins = checkins.filter(c => {
    const userNameMatch = c.user?.name?.toLowerCase().includes(filterUser.toLowerCase()) || 
                          c.user?.email?.toLowerCase().includes(filterUser.toLowerCase());
    const locationNameMatch = c.location?.name?.toLowerCase().includes(filterLocation.toLowerCase());
    
    if (filterUser && !userNameMatch) return false;
    if (filterLocation && !locationNameMatch) return false;

    if (c.checkedInAt) {
      const checkinDate = parseISO(c.checkedInAt);
      if (startDate) {
        const start = new Date(`${startDate}T00:00:00`);
        if (checkinDate < start) return false;
      }
      if (endDate) {
        const end = new Date(`${endDate}T23:59:59`);
        if (checkinDate > end) return false;
      }
    }

    return true;
  });

  // Grouping logic: Location -> Date -> Checkins
  const groupedData: GroupedData = {};

  filteredCheckins.forEach(checkin => {
    const locId = checkin.location?.id || 'unknown';
    const locName = checkin.location?.name || 'Unknown Location';
    
    // Format date as YYYY-MM-DD
    const dateStr = checkin.checkedInAt 
      ? format(parseISO(checkin.checkedInAt), 'yyyy-MM-dd')
      : 'unknown-date';

    if (!groupedData[locId]) {
      groupedData[locId] = {
        locationName: locName,
        dates: {},
        totalCount: 0
      };
    }

    if (!groupedData[locId].dates[dateStr]) {
      groupedData[locId].dates[dateStr] = [];
    }

    groupedData[locId].dates[dateStr].push(checkin);
    groupedData[locId].totalCount += 1;
  });

  const toggleLocation = (locId: string) => {
    setExpandedLocations(prev => ({
      ...prev,
      [locId]: !prev[locId]
    }));
  };

  const toggleDate = (dateKey: string) => {
    setExpandedDates(prev => ({
      ...prev,
      [dateKey]: !prev[dateKey]
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Activity className="text-emerald-400" />
            Check-ins
          </h1>
          <p className="text-zinc-400 mt-1">
            {user?.role === 'admin' ? 'View all check-in activities across locations.' : 'View your recent check-in activity.'}
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {user?.role === 'admin' && (
            <button
              onClick={() => setIsManualModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-emerald-500/20 mr-2"
            >
              <Plus className="w-4 h-4" />
              Manual Check-in
            </button>
          )}

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Filter by user..."
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
              className="pl-9 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
            />
          </div>
          <div className="relative">
            <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Filter by location..."
              value={filterLocation}
              onChange={(e) => setFilterLocation(e.target.value)}
              className="pl-9 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1 text-sm text-zinc-400">
            <span>From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-white focus:outline-none border-none text-xs [color-scheme:dark]"
            />
            <span className="ml-1">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-white focus:outline-none border-none text-xs [color-scheme:dark]"
            />
            {(startDate || endDate) && (
              <button 
                onClick={() => { setStartDate(''); setEndDate(''); }}
                className="ml-2 text-zinc-500 hover:text-white text-xs border border-zinc-800 px-1.5 py-0.5 rounded bg-zinc-950 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex border-b border-zinc-800">
        <button
          onClick={() => setActiveTab('history')}
          className={`pb-4 px-4 font-medium text-sm transition-colors relative ${activeTab === 'history' ? 'text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          Lịch sử Check-in
          {activeTab === 'history' && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-500 rounded-t-full"></div>
          )}
        </button>
        <button
          onClick={() => setActiveTab('stats')}
          className={`pb-4 px-4 font-medium text-sm transition-colors relative ${activeTab === 'stats' ? 'text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          Thống kê (Statistics)
          {activeTab === 'stats' && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-500 rounded-t-full"></div>
          )}
        </button>
      </div>

      {activeTab === 'stats' && (
        <div className="space-y-6">
          {(!startDate || !endDate) ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center text-zinc-500">
              Vui lòng chọn khoảng thời gian (From / To) để xem thống kê.
            </div>
          ) : isLoading ? (
            <div className="flex justify-center p-12">
              <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <>
              <div className="flex justify-end mb-4">
                <button
                  onClick={handleExport}
                  disabled={isExporting}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-blue-500/20"
                >
                  {isExporting ? 'Đang xuất...' : 'Xuất file Excel'}
                </button>
              </div>

              {statsData && statsData.summary.length > 0 ? (
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-zinc-800 text-zinc-400 bg-zinc-900/50">
                          <th className="p-4 font-medium">Nhân viên</th>
                          <th className="p-4 font-medium text-center">Tổng ngày</th>
                          <th className="p-4 font-medium text-center">Tổng giờ</th>
                          <th className="p-4 font-medium text-center text-amber-500">Đi muộn</th>
                          <th className="p-4 font-medium text-center text-zinc-500">Thiếu Check-out</th>
                          <th className="p-4 font-medium text-center text-red-500">Cảnh báo gian lận</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800">
                        {statsData.summary.map(sum => (
                          <tr key={sum.userId} className="hover:bg-zinc-800/50 transition-colors">
                            <td className="p-4">
                              <div className="font-medium text-white">{sum.userName}</div>
                              <div className="text-xs text-zinc-500">{sum.userEmail}</div>
                            </td>
                            <td className="p-4 text-center text-white font-medium">{sum.totalWorkingDays}</td>
                            <td className="p-4 text-center text-white font-medium">{sum.totalWorkingHours}</td>
                            <td className="p-4 text-center text-amber-500 font-medium">{sum.lateCount > 0 ? sum.lateCount : '-'}</td>
                            <td className="p-4 text-center text-zinc-400 font-medium">{sum.missingDataCount > 0 ? sum.missingDataCount : '-'}</td>
                            <td className="p-4 text-center text-red-500 font-medium">{sum.fraudCount > 0 ? sum.fraudCount : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center text-zinc-500">
                  Không có dữ liệu thống kê trong khoảng thời gian này.
                </div>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <>
          {isLoading ? (
        <div className="flex justify-center p-12">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : filteredCheckins.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center text-zinc-500">
          No check-ins found matching your criteria.
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedData).map(([locId, locGroup]) => {
            const isLocExpanded = !!expandedLocations[locId];

            return (
              <div key={locId} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-md">
                {/* Location Header */}
                <button
                  onClick={() => toggleLocation(locId)}
                  className="w-full flex items-center justify-between p-5 hover:bg-zinc-800/30 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20 text-emerald-400">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-white">{locGroup.locationName}</h2>
                      <p className="text-xs text-zinc-500 font-mono mt-0.5">{locId}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="px-3 py-1 bg-zinc-800 text-zinc-300 border border-zinc-700 text-xs font-medium rounded-full">
                      {locGroup.totalCount} {locGroup.totalCount === 1 ? 'check-in' : 'check-ins'}
                    </span>
                    {isLocExpanded ? (
                      <ChevronDown className="w-5 h-5 text-zinc-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-zinc-400" />
                    )}
                  </div>
                </button>

                {/* Dates under Location */}
                {isLocExpanded && (
                  <div className="border-t border-zinc-800 bg-zinc-950/30 p-4 space-y-3">
                    {Object.entries(locGroup.dates).sort((a, b) => b[0].localeCompare(a[0])).map(([dateStr, items]) => {
                      const dateKey = `${locId}_${dateStr}`;
                      const isDateExpanded = !!expandedDates[dateKey];
                      const formattedDate = format(parseISO(`${dateStr}T00:00:00`), 'EEEE, MMMM d, yyyy');

                      return (
                        <div key={dateStr} className="border border-zinc-800/60 bg-zinc-900/50 rounded-lg overflow-hidden">
                          {/* Date Header */}
                          <button
                            onClick={() => toggleDate(dateKey)}
                            className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-800/20 transition-colors text-left"
                          >
                            <div className="flex items-center gap-2 text-zinc-300">
                              <Calendar className="w-4 h-4 text-emerald-400" />
                              <span className="text-sm font-medium">{formattedDate}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-zinc-400">
                                {items.length} {items.length === 1 ? 'user' : 'users'}
                              </span>
                              {isDateExpanded ? (
                                <ChevronDown className="w-4 h-4 text-zinc-500" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-zinc-500" />
                              )}
                            </div>
                          </button>

                          {/* Users table/list for this date */}
                          {isDateExpanded && (
                            <div className="border-t border-zinc-800 bg-zinc-950/50">
                              <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                  <thead>
                                    <tr className="border-b border-zinc-800/60 text-zinc-400 text-xs bg-zinc-900/30">
                                      <th className="px-4 py-2 font-medium">Time</th>
                                      <th className="px-4 py-2 font-medium">User</th>
                                      <th className="px-4 py-2 font-medium">Direction</th>
                                      <th className="px-4 py-2 font-medium">Status</th>
                                      <th className="px-4 py-2 font-medium w-1/3">Note</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-zinc-800/40 text-sm">
                                    {items.sort((a, b) => b.checkedInAt.localeCompare(a.checkedInAt)).map((item) => (
                                      <tr key={item.id} className="hover:bg-zinc-800/20 transition-colors">
                                        <td className="px-4 py-3 text-white font-medium whitespace-nowrap">
                                          {format(parseISO(item.checkedInAt), 'HH:mm:ss')}
                                        </td>
                                        <td className="px-4 py-3">
                                          {item.user ? (
                                            <div className="flex items-center gap-2">
                                              <div className="p-1 bg-zinc-800 rounded-full border border-zinc-700">
                                                <User className="w-3.5 h-3.5 text-zinc-400" />
                                              </div>
                                              <div>
                                                <div className="text-white font-medium text-xs leading-tight">{item.user.name}</div>
                                                <div className="text-[10px] text-zinc-500 leading-none mt-0.5">{item.user.email}</div>
                                              </div>
                                            </div>
                                          ) : (
                                            <span className="text-zinc-500 italic text-xs">Unknown User</span>
                                          )}
                                        </td>
                                        <td className="px-4 py-3">
                                          {item.direction === 'in' ? (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 uppercase">
                                              IN
                                            </span>
                                          ) : item.direction === 'out' ? (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30 uppercase">
                                              OUT
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-zinc-500 border border-zinc-700 uppercase">
                                              UNK
                                            </span>
                                          )}
                                        </td>
                                        <td className="px-4 py-3">
                                          {item.status === 'success' ? (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                              Đúng giờ
                                            </span>
                                          ) : item.status === 'late' ? (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                              Muộn
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">
                                              -
                                            </span>
                                          )}
                                        </td>
                                        <td className="px-4 py-3 text-zinc-400 text-xs italic">
                                          {item.note || '-'}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      </>
      )}

      {isManualModalOpen && (
        <ManualCheckinModal 
          onClose={() => setIsManualModalOpen(false)}
          onSuccess={fetchCheckins}
        />
      )}
    </div>
  );
}
