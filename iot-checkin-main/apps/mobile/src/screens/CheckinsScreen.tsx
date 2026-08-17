import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, SafeAreaView,
  RefreshControl, TouchableOpacity, TextInput, Platform, Alert,
} from 'react-native';
import { api } from '../lib/api';
import { Activity, Clock, User, MapPin, Search, Filter, ChevronDown, ChevronRight, Calendar, AlertTriangle, AlertCircle, Download } from 'lucide-react-native';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { format, parseISO } from 'date-fns';
import { theme } from 'libs';
import type { CheckinResponse, CheckinStatsResponse } from 'libs';

interface DateGroup {
  [dateStr: string]: CheckinResponse[];
}

interface GroupedData {
  [locationId: string]: {
    locationName: string;
    dates: DateGroup;
    totalCount: number;
  };
}

export const CheckinsScreen = () => {
  const [checkins, setCheckins] = useState<CheckinResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const route = useRoute<any>();
  
  const [filterUser, setFilterUser] = useState(route.params?.filterUser || '');
  const [filterLocation, setFilterLocation] = useState(route.params?.filterLocation || '');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Stats State
  const [activeTab, setActiveTab] = useState<'history' | 'stats'>('history');
  const [statsData, setStatsData] = useState<CheckinStatsResponse | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Accordion states
  const [expandedLocations, setExpandedLocations] = useState<Record<string, boolean>>({});
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (route.params?.filterUser !== undefined) {
      setFilterUser(route.params.filterUser);
    }
    if (route.params?.filterLocation !== undefined) {
      setFilterLocation(route.params.filterLocation);
    }
  }, [route.params?.filterUser, route.params?.filterLocation]);

  const fetchCheckins = async () => {
    try {
      const response = await api.get('/checkins');
      setCheckins(response.data);
      setError('');
    } catch (err) {
      console.error('Failed to fetch check-ins:', err);
      setError('Failed to load check-in history.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchStats = async () => {
    if (!startDate || !endDate) return;
    setStatsLoading(true);
    try {
      const response = await api.get('/checkins-stats', {
        params: {
          startDate,
          endDate,
          locationId: filterLocation || undefined
        }
      });
      setStatsData(response.data);
      setError('');
    } catch (err) {
      console.error('Failed to fetch check-in stats:', err);
      setError('Failed to load check-in statistics.');
    } finally {
      setStatsLoading(false);
      setRefreshing(false);
    }
  };

  const handleExport = async () => {
    if (!startDate || !endDate) return;
    
    if (Platform.OS !== 'web') {
      Alert.alert('Chưa hỗ trợ', 'Tính năng xuất Excel hiện chỉ hỗ trợ trên phiên bản Web/Dashboard.');
      return;
    }

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
      link.setAttribute('download', `Thong_Ke_Checkin_${startDate}_${endDate}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err: any) {
      console.error('Failed to export:', err);
      Alert.alert('Lỗi', 'Không thể xuất file Excel.');
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'stats' && startDate && endDate) {
      fetchStats();
    }
  }, [activeTab, startDate, endDate, filterLocation]);

  useFocusEffect(
    useCallback(() => {
      if (activeTab === 'history') {
        fetchCheckins();
      }
    }, [activeTab])
  );

  const onRefresh = () => {
    setRefreshing(true);
    if (activeTab === 'history') {
      fetchCheckins();
    } else {
      fetchStats();
    }
  };

  const filteredCheckins = checkins.filter(c => {
    const userMatch = c.user?.name?.toLowerCase().includes(filterUser.toLowerCase())
      || c.user?.email?.toLowerCase().includes(filterUser.toLowerCase());
    const locationMatch = c.location?.name?.toLowerCase().includes(filterLocation.toLowerCase());

    if (filterUser && !userMatch) return false;
    if (filterLocation && !locationMatch) return false;

    if (c.checkedInAt) {
      const checkinDate = parseISO(c.checkedInAt);
      if (startDate) {
        // Handle native text typing vs web ISO date selection
        const start = new Date(startDate.includes('T') ? startDate : `${startDate}T00:00:00`);
        if (!isNaN(start.getTime()) && checkinDate < start) return false;
      }
      if (endDate) {
        const end = new Date(endDate.includes('T') ? endDate : `${endDate}T23:59:59`);
        if (!isNaN(end.getTime()) && checkinDate > end) return false;
      }
    }

    return true;
  });

  // Group check-ins: Location -> Date -> Checkins
  const groupedData: GroupedData = {};

  filteredCheckins.forEach(c => {
    const locId = c.location?.id || 'unknown';
    const locName = c.location?.name || 'Unknown Location';
    const dateStr = c.checkedInAt
      ? format(parseISO(c.checkedInAt), 'yyyy-MM-dd')
      : 'unknown-date';

    if (!groupedData[locId]) {
      groupedData[locId] = {
        locationName: locName,
        dates: {},
        totalCount: 0,
      };
    }

    if (!groupedData[locId].dates[dateStr]) {
      groupedData[locId].dates[dateStr] = [];
    }

    groupedData[locId].dates[dateStr].push(c);
    groupedData[locId].totalCount += 1;
  });

  const toggleLocation = (locId: string) => {
    setExpandedLocations(prev => ({
      ...prev,
      [locId]: !prev[locId],
    }));
  };

  const toggleDate = (dateKey: string) => {
    setExpandedDates(prev => ({
      ...prev,
      [dateKey]: !prev[dateKey],
    }));
  };

  if (loading && !refreshing) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={theme.colors.emerald[500]} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Page header */}
        <View style={styles.pageHeader}>
          <Activity color={theme.colors.emerald[400]} size={24} style={styles.headerIcon} />
          <View style={styles.pageHeaderText}>
            <Text style={styles.title}>Check-ins</Text>
            <Text style={styles.subtitle}>View your recent check-in activity.</Text>
          </View>
        </View>

        {/* Filters */}
        <View style={styles.filtersRow}>
          <View style={styles.filterInput}>
            <Search color={theme.colors.zinc[500]} size={14} style={styles.filterIcon} />
            <TextInput
              style={styles.filterText}
              placeholder="Filter by user..."
              placeholderTextColor={theme.colors.zinc[500]}
              value={filterUser}
              onChangeText={setFilterUser}
              autoCapitalize="none"
            />
          </View>
          <View style={styles.filterInput}>
            <Filter color={theme.colors.zinc[500]} size={14} style={styles.filterIcon} />
            <TextInput
              style={styles.filterText}
              placeholder="Filter by location..."
              placeholderTextColor={theme.colors.zinc[500]}
              value={filterLocation}
              onChangeText={setFilterLocation}
              autoCapitalize="none"
            />
          </View>
        </View>

        {/* Date Range Filters */}
        <View style={styles.dateFiltersRow}>
          <View style={styles.dateInputWrapper}>
            <Text style={styles.dateLabel}>From:</Text>
            {Platform.OS === 'web' ? (
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{
                  background: 'transparent',
                  color: '#fafafa',
                  border: 'none',
                  outline: 'none',
                  fontSize: '13px',
                  flex: 1,
                  colorScheme: 'dark',
                  padding: '8px 0',
                }}
              />
            ) : (
              <TextInput
                style={styles.dateInput}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={theme.colors.zinc[500]}
                value={startDate}
                onChangeText={setStartDate}
                maxLength={10}
              />
            )}
          </View>
          <View style={styles.dateInputWrapper}>
            <Text style={styles.dateLabel}>To:</Text>
            {Platform.OS === 'web' ? (
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{
                  background: 'transparent',
                  color: '#fafafa',
                  border: 'none',
                  outline: 'none',
                  fontSize: '13px',
                  flex: 1,
                  colorScheme: 'dark',
                  padding: '8px 0',
                }}
              />
            ) : (
              <TextInput
                style={styles.dateInput}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={theme.colors.zinc[500]}
                value={endDate}
                onChangeText={setEndDate}
                maxLength={10}
              />
            )}
          </View>
          {(startDate || endDate) ? (
            <TouchableOpacity 
              onPress={() => { setStartDate(''); setEndDate(''); }}
              style={styles.clearDatesBtn}
              activeOpacity={0.7}
            >
              <Text style={styles.clearDatesText}>Clear</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={styles.tabButton}
            onPress={() => setActiveTab('history')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === 'history' && styles.activeTabText]}>
              Lịch sử Check-in
            </Text>
            {activeTab === 'history' && <View style={styles.activeTabIndicator} />}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.tabButton}
            onPress={() => setActiveTab('stats')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === 'stats' && styles.activeTabText]}>
              Thống kê (Statistics)
            </Text>
            {activeTab === 'stats' && <View style={styles.activeTabIndicator} />}
          </TouchableOpacity>
        </View>

        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : activeTab === 'history' ? (
          filteredCheckins.length === 0 ? (
            <View style={styles.emptyState}>
              <Clock color={theme.colors.zinc[700]} size={48} />
            <Text style={styles.emptyStateTitle}>
              {checkins.length === 0 ? 'No Check-ins Yet' : 'No results found'}
            </Text>
            <Text style={styles.emptyStateDesc}>
              {checkins.length === 0
                ? 'Your check-in history will appear here once you start checking in.'
                : 'Try adjusting your filter criteria.'}
            </Text>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={theme.colors.emerald[500]}
                colors={[theme.colors.emerald[500]]}
              />
            }
          >
            <View style={styles.groupsContainer}>
              {Object.entries(groupedData).map(([locId, locGroup]) => {
                const isLocExpanded = !!expandedLocations[locId];

                return (
                  <View key={locId} style={styles.locationGroup}>
                    {/* Location Header Accordion Trigger */}
                    <TouchableOpacity
                      style={[styles.locationHeader, isLocExpanded && styles.expandedHeader]}
                      onPress={() => toggleLocation(locId)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.locationInfo}>
                        <View style={styles.locIconWrapper}>
                          <MapPin color={theme.colors.emerald[400]} size={16} />
                        </View>
                        <View style={styles.locationTextContainer}>
                          <Text style={styles.locationName} numberOfLines={1}>
                            {locGroup.locationName}
                          </Text>
                          <Text style={styles.locationId} numberOfLines={1}>
                            {locId}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.rightInfo}>
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>
                            {locGroup.totalCount} {locGroup.totalCount === 1 ? 'check-in' : 'check-ins'}
                          </Text>
                        </View>
                        {isLocExpanded ? (
                          <ChevronDown color={theme.colors.zinc[400]} size={18} />
                        ) : (
                          <ChevronRight color={theme.colors.zinc[400]} size={18} />
                        )}
                      </View>
                    </TouchableOpacity>

                    {/* Dates list */}
                    {isLocExpanded && (
                      <View style={styles.datesContainer}>
                        {Object.entries(locGroup.dates)
                          .sort((a, b) => b[0].localeCompare(a[0]))
                          .map(([dateStr, items]) => {
                            const dateKey = `${locId}_${dateStr}`;
                            const isDateExpanded = !!expandedDates[dateKey];
                            const formattedDate = format(parseISO(`${dateStr}T00:00:00`), 'EEE, MMM d, yyyy');

                            return (
                              <View key={dateStr} style={styles.dateCard}>
                                <TouchableOpacity
                                  style={styles.dateHeader}
                                  onPress={() => toggleDate(dateKey)}
                                  activeOpacity={0.8}
                                >
                                  <View style={styles.dateInfo}>
                                    <Calendar color={theme.colors.emerald[400]} size={14} />
                                    <Text style={styles.dateText}>{formattedDate}</Text>
                                  </View>
                                  <View style={styles.rightInfo}>
                                    <Text style={styles.userCountText}>
                                      {items.length} {items.length === 1 ? 'user' : 'users'}
                                    </Text>
                                    {isDateExpanded ? (
                                      <ChevronDown color={theme.colors.zinc[500]} size={16} />
                                    ) : (
                                      <ChevronRight color={theme.colors.zinc[500]} size={16} />
                                    )}
                                  </View>
                                </TouchableOpacity>

                                {/* Check-in Items Table under Date */}
                                {isDateExpanded && (
                                  <View style={styles.checkinsList}>
                                    {items
                                      .sort((a, b) => b.checkedInAt.localeCompare(a.checkedInAt))
                                      .map((item) => (
                                        <View key={item.id} style={styles.checkinRow}>
                                          <View style={styles.timeColumn}>
                                            <Text style={styles.checkinTime}>
                                              {format(parseISO(item.checkedInAt), 'HH:mm:ss')}
                                            </Text>
                                            <View style={[
                                              styles.directionBadge,
                                              item.direction === 'in' ? styles.directionIn :
                                              item.direction === 'out' ? styles.directionOut :
                                              styles.directionUnk
                                            ]}>
                                              <Text style={[
                                                styles.directionText,
                                                item.direction === 'in' ? styles.directionInText :
                                                item.direction === 'out' ? styles.directionOutText :
                                                styles.directionUnkText
                                              ]}>
                                                {item.direction === 'in' ? 'IN' : item.direction === 'out' ? 'OUT' : 'UNK'}
                                              </Text>
                                            </View>
                                          </View>

                                          <View style={styles.userColumn}>
                                            {item.user ? (
                                              <View style={styles.userDetails}>
                                                <View style={styles.avatarMini}>
                                                  <User color={theme.colors.zinc[400]} size={10} />
                                                </View>
                                                <View style={styles.userInfoText}>
                                                  <Text style={styles.checkinUserName} numberOfLines={1}>
                                                    {item.user.name}
                                                  </Text>
                                                  <Text style={styles.checkinUserEmail} numberOfLines={1}>
                                                    {item.user.email}
                                                  </Text>
                                                </View>
                                              </View>
                                            ) : (
                                              <Text style={styles.unknownUser}>Unknown User</Text>
                                            )}
                                            {item.note ? (
                                              <Text style={styles.checkinNote} numberOfLines={2}>
                                                "{item.note}"
                                              </Text>
                                            ) : null}
                                          </View>
                                        </View>
                                      ))}
                                  </View>
                                )}
                              </View>
                            );
                          })}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </ScrollView>
          )
        ) : (
          /* Stats View */
          <ScrollView
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={theme.colors.emerald[500]}
                colors={[theme.colors.emerald[500]]}
              />
            }
          >
            {(!startDate || !endDate) ? (
              <View style={styles.emptyState}>
                <Calendar color={theme.colors.zinc[700]} size={48} />
                <Text style={styles.emptyStateTitle}>Chọn khoảng thời gian</Text>
                <Text style={styles.emptyStateDesc}>
                  Vui lòng chọn Từ ngày và Đến ngày để xem thống kê.
                </Text>
              </View>
            ) : statsLoading ? (
              <View style={[styles.emptyState, { marginTop: 40 }]}>
                <ActivityIndicator size="large" color={theme.colors.emerald[500]} />
              </View>
            ) : statsData && statsData.summary.length > 0 ? (
              <View style={styles.statsContainer}>
                {Platform.OS === 'web' && (
                  <TouchableOpacity 
                    style={[styles.exportBtn, isExporting && { opacity: 0.5 }]} 
                    onPress={handleExport}
                    disabled={isExporting}
                  >
                    {isExporting ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Download color="#fff" size={16} />
                        <Text style={styles.exportBtnText}>Xuất Excel</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
                {statsData.summary.map(sum => (
                  <View key={sum.userId} style={styles.statCard}>
                    <View style={styles.statHeader}>
                      <View style={styles.statAvatar}>
                        <User color={theme.colors.zinc[400]} size={16} />
                      </View>
                      <View style={styles.statUserInfo}>
                        <Text style={styles.statUserName} numberOfLines={1}>{sum.userName}</Text>
                        <Text style={styles.statUserEmail} numberOfLines={1}>{sum.userEmail}</Text>
                      </View>
                    </View>
                    
                    <View style={styles.statMetrics}>
                      <View style={styles.statMetricItem}>
                        <Text style={styles.statMetricValue}>{sum.totalWorkingDays}</Text>
                        <Text style={styles.statMetricLabel}>Ngày làm</Text>
                      </View>
                      <View style={styles.statMetricDivider} />
                      <View style={styles.statMetricItem}>
                        <Text style={styles.statMetricValue}>{sum.totalWorkingHours}</Text>
                        <Text style={styles.statMetricLabel}>Tổng giờ</Text>
                      </View>
                      <View style={styles.statMetricDivider} />
                      <View style={styles.statMetricItem}>
                        <Text style={[styles.statMetricValue, sum.lateCount > 0 && styles.textWarning]}>
                          {sum.lateCount > 0 ? sum.lateCount : '-'}
                        </Text>
                        <Text style={styles.statMetricLabel}>Đi muộn</Text>
                      </View>
                    </View>
                    
                    {(sum.missingDataCount > 0 || sum.fraudCount > 0) && (
                      <View style={styles.statWarnings}>
                        {sum.missingDataCount > 0 && (
                          <View style={styles.warningPill}>
                            <AlertCircle color={theme.colors.zinc[400]} size={12} />
                            <Text style={styles.warningPillText}>{sum.missingDataCount} Thiếu Checkout</Text>
                          </View>
                        )}
                        {sum.fraudCount > 0 && (
                          <View style={[styles.warningPill, styles.fraudPill]}>
                            <AlertTriangle color={theme.colors.red[400]} size={12} />
                            <Text style={styles.fraudPillText}>{sum.fraudCount} Cảnh báo Gian lận</Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Activity color={theme.colors.zinc[700]} size={48} />
                <Text style={styles.emptyStateTitle}>Không có dữ liệu</Text>
                <Text style={styles.emptyStateDesc}>
                  Không có thống kê nào trong khoảng thời gian này.
                </Text>
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.zinc[950],
  },
  container: {
    flex: 1,
    padding: theme.spacing.lg,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.zinc[950],
  },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    marginTop: 8,
  },
  headerIcon: {
    marginTop: 4,
  },
  pageHeaderText: {
    marginLeft: 10,
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: theme.colors.zinc[50],
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.zinc[400],
    marginTop: 2,
  },
  /* Filters */
  filtersRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  filterInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.zinc[900],
    borderWidth: 1,
    borderColor: theme.colors.zinc[800],
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: 10,
  },
  filterIcon: {
    marginRight: 6,
  },
  filterText: {
    flex: 1,
    paddingVertical: 10,
    color: theme.colors.zinc[50],
    fontSize: 13,
  },
  /* Date Filters */
  dateFiltersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  dateInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.zinc[900],
    borderWidth: 1,
    borderColor: theme.colors.zinc[800],
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: 10,
  },
  dateLabel: {
    color: theme.colors.zinc[400],
    fontSize: 12,
    marginRight: 4,
  },
  dateInput: {
    flex: 1,
    paddingVertical: 10,
    color: theme.colors.zinc[50],
    fontSize: 13,
  },
  clearDatesBtn: {
    backgroundColor: theme.colors.zinc[900],
    borderWidth: 1,
    borderColor: theme.colors.zinc[800],
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  clearDatesText: {
    color: theme.colors.zinc[400],
    fontSize: 13,
    fontWeight: '500',
  },
  groupsContainer: {
    paddingBottom: theme.spacing.xl,
  },
  /* Accordion Groups */
  locationGroup: {
    backgroundColor: theme.colors.zinc[900],
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.zinc[800],
    marginBottom: 12,
    overflow: 'hidden',
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  expandedHeader: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.zinc[800],
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  locIconWrapper: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
    padding: 6,
    borderRadius: 8,
    marginRight: 10,
  },
  locationTextContainer: {
    flex: 1,
  },
  locationName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.zinc[50],
  },
  locationId: {
    fontSize: 10,
    color: theme.colors.zinc[550] || '#71717a',
    fontFamily: 'monospace',
    marginTop: 2,
  },
  rightInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    backgroundColor: theme.colors.zinc[800],
    borderWidth: 1,
    borderColor: theme.colors.zinc[700],
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '500',
    color: theme.colors.zinc[300],
  },
  /* Dates List */
  datesContainer: {
    backgroundColor: 'rgba(9, 9, 11, 0.2)',
    padding: 12,
    gap: 8,
  },
  dateCard: {
    backgroundColor: theme.colors.zinc[950],
    borderWidth: 1,
    borderColor: theme.colors.zinc[850] || '#27272a',
    borderRadius: 10,
    overflow: 'hidden',
  },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.colors.zinc[300],
  },
  userCountText: {
    fontSize: 11,
    color: theme.colors.zinc[500],
  },
  /* Check-in detailed rows */
  checkinsList: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.zinc[900],
    backgroundColor: 'rgba(9, 9, 11, 0.4)',
    paddingHorizontal: 12,
    paddingBottom: 4,
  },
  checkinRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: theme.colors.zinc[900],
  },
  timeColumn: {
    width: 65,
    justifyContent: 'flex-start',
  },
  checkinTime: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.zinc[100],
  },
  directionBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
    borderWidth: 1,
  },
  directionIn: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  directionOut: {
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    borderColor: 'rgba(168, 85, 247, 0.3)',
  },
  directionUnk: {
    backgroundColor: '#27272a',
    borderColor: '#3f3f46',
  },
  directionText: {
    fontSize: 9,
    fontWeight: 'bold',
  },
  directionInText: {
    color: '#60a5fa',
  },
  directionOutText: {
    color: '#c084fc',
  },
  directionUnkText: {
    color: '#a1a1aa',
  },
  userColumn: {
    flex: 1,
    paddingLeft: 6,
  },
  userDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  avatarMini: {
    backgroundColor: theme.colors.zinc[900],
    borderWidth: 1,
    borderColor: theme.colors.zinc[800],
    padding: 3,
    borderRadius: 99,
  },
  userInfoText: {
    flex: 1,
  },
  checkinUserName: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.colors.zinc[50],
    lineHeight: 14,
  },
  checkinUserEmail: {
    fontSize: 10,
    color: theme.colors.zinc[500],
    lineHeight: 12,
    marginTop: 1,
  },
  checkinNote: {
    fontSize: 11,
    color: theme.colors.zinc[400],
    fontStyle: 'italic',
    marginTop: 2,
    paddingLeft: 2,
  },
  unknownUser: {
    fontSize: 11,
    color: theme.colors.zinc[550] || '#71717a',
    fontStyle: 'italic',
  },
  /* General style overrides */
  errorText: {
    color: theme.colors.red[400],
    textAlign: 'center',
    marginTop: 40,
    fontSize: 14,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    marginTop: 50,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.zinc[50],
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateDesc: {
    fontSize: 14,
    color: theme.colors.zinc[400],
    textAlign: 'center',
    lineHeight: 22,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb', // blue-600
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: 'flex-end',
    marginBottom: 16,
    gap: 6,
  },
  exportBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  /* Tabs */
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.zinc[800],
    marginBottom: 16,
  },
  tabButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    position: 'relative',
    marginRight: 8,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.zinc[500],
  },
  activeTabText: {
    color: theme.colors.emerald[400],
  },
  activeTabIndicator: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: theme.colors.emerald[500],
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  /* Stats Cards */
  statsContainer: {
    paddingBottom: 24,
    gap: 12,
  },
  statCard: {
    backgroundColor: theme.colors.zinc[900],
    borderWidth: 1,
    borderColor: theme.colors.zinc[800],
    borderRadius: 16,
    padding: 16,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  statAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.zinc[800],
    borderWidth: 1,
    borderColor: theme.colors.zinc[700],
    alignItems: 'center',
    justifyContent: 'center',
  },
  statUserInfo: {
    flex: 1,
  },
  statUserName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.zinc[50],
  },
  statUserEmail: {
    fontSize: 12,
    color: theme.colors.zinc[400],
    marginTop: 2,
  },
  statMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(9, 9, 11, 0.3)',
    borderRadius: 12,
    padding: 12,
  },
  statMetricItem: {
    flex: 1,
    alignItems: 'center',
  },
  statMetricDivider: {
    width: 1,
    height: 24,
    backgroundColor: theme.colors.zinc[800],
  },
  statMetricValue: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.zinc[100],
  },
  statMetricLabel: {
    fontSize: 11,
    color: theme.colors.zinc[500],
    marginTop: 4,
    textTransform: 'uppercase',
  },
  textWarning: {
    color: theme.colors.amber[400],
  },
  statWarnings: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.zinc[800],
  },
  warningPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.zinc[800],
    borderWidth: 1,
    borderColor: theme.colors.zinc[700],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  warningPillText: {
    fontSize: 11,
    fontWeight: '500',
    color: theme.colors.zinc[300],
  },
  fraudPill: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  fraudPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.red[400],
  },
});
