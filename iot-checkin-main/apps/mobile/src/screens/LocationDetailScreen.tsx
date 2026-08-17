import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, SafeAreaView, TouchableOpacity, Alert, TextInput, Platform, ScrollView } from 'react-native';
import { api } from '../lib/api';
import { ArrowLeft, UserMinus, Users, Fingerprint, Cpu, Trash2, Plus, Wifi } from 'lucide-react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { theme, WorkSchedule } from 'libs';
import { useAuth } from '../context/AuthContext';

interface UserData {
  id: string;
  name: string;
  email: string;
  fingerprintIds?: number[];
  fingerprints?: { fingerId: number; deviceId: string }[];
}

interface DeviceData {
  id: string;
  clientId: string;
  name: string | null;
  ipAddress?: string | null;
  lastSeenAt?: string | null;
  isOnline?: boolean;
}

interface LocationDetail {
  id: string;
  name: string;
  adminId: string | null;
  joinCode?: string;
  workSchedule?: WorkSchedule | null;
  users?: UserData[];
  devices?: DeviceData[];
}


export const LocationDetailScreen = () => {
  const route = useRoute<any>();
  const navigation = useNavigation();
  const { locationId } = route.params;

  const { user } = useAuth();
  const [location, setLocation] = useState<LocationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrollMessage, setEnrollMessage] = useState('');
  const [scanReports, setScanReports] = useState<any[]>([]);

  // Add Device State
  const [isAddingDevice, setIsAddingDevice] = useState(false);
  const [newDeviceClientId, setNewDeviceClientId] = useState('');
  const [newDeviceName, setNewDeviceName] = useState('');


  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [checkins, setCheckins] = useState<any[]>([]);

  const fetchData = async () => {
    try {
      const response = await api.get(`/locations/${locationId}`);
      setLocation(response.data);
      
      try {
        const checkinsRes = await api.get('/checkins');
        setCheckins(checkinsRes.data);
      } catch (err) {
        console.error('Failed to fetch checkins', err);
      }

      if (user?.role === 'admin' || user?.id === response.data.adminId) {
        try {
          const reportsRes = await api.get(`/locations/${locationId}/devices/scan-reports`);
          setScanReports(reportsRes.data);
        } catch (err) {
          console.error('Failed to fetch scan reports', err);
        }
      }
    } catch (error: any) {
      console.error('Failed to fetch location', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to load location details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [locationId]);

  const handleRemoveUser = (userId: string, userName: string) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`Remove "${userName}" from this location?`)) {
        api.delete(`/locations/${locationId}/users/${userId}`)
          .then(() => fetchData())
          .catch((error: any) => Alert.alert('Error', error.response?.data?.message || 'Failed to remove user.'));
      }
      return;
    }

    Alert.alert(
      'Remove User',
      `Remove "${userName}" from this location?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/locations/${locationId}/users/${userId}`);
              fetchData();
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.message || 'Failed to remove user.');
            }
          },
        },
      ],
    );
  };

  const handleAddDevice = async () => {
    if (!newDeviceClientId.trim()) {
      Alert.alert('Error', 'Device Client ID is required');
      return;
    }
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
      Alert.alert('Error', error.response?.data?.message || 'Failed to add device');
    }
  };

  const handleRemoveDevice = (deviceId: string, deviceName: string) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`Remove "${deviceName}"?`)) {
        api.delete(`/locations/${locationId}/devices/${deviceId}`)
          .then(() => fetchData())
          .catch((error: any) => Alert.alert('Error', error.response?.data?.message || 'Failed to remove device.'));
      }
      return;
    }

    Alert.alert(
      'Remove Device',
      `Remove "${deviceName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/locations/${locationId}/devices/${deviceId}`);
              fetchData();
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.message || 'Failed to remove device.');
            }
          },
        },
      ],
    );
  };



  const handleRequestEnrollForUser = async (targetUserId: string) => {
    try {
      const res = await api.post(`/locations/${locationId}/fingerprints/request-enroll`, { userId: targetUserId });
      setEnrollMessage(res.data.message);
      setTimeout(() => setEnrollMessage(''), 10000);
    } catch (error: any) {
      console.error('Failed to request enrollment for user', error);
      Alert.alert('Enrollment Failed', error.response?.data?.message || 'Could not request enrollment.');
    }
  };

  const handleDeleteFingerprint = (deviceId: string, fingerId: number, userName: string) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`Xóa vân tay ID ${fingerId} của ${userName} trên thiết bị này?`)) {
        api.post(`/locations/${locationId}/devices/${deviceId}/command`, {
          command: 'delete_finger',
          fingerId,
        })
          .then(() => {
            Alert.alert('Success', `Đã gửi lệnh xóa vân tay ID ${fingerId} tới thiết bị.`);
            fetchData();
          })
          .catch((error: any) => Alert.alert('Error', error.response?.data?.message || 'Failed to delete fingerprint'));
      }
      return;
    }

    Alert.alert(
      'Delete Fingerprint',
      `Xóa vân tay ID ${fingerId} của ${userName} trên thiết bị này?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.post(`/locations/${locationId}/devices/${deviceId}/command`, {
                command: 'delete_finger',
                fingerId,
              });
              Alert.alert('Success', `Đã gửi lệnh xóa vân tay ID ${fingerId} tới thiết bị.`);
              fetchData();
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.message || 'Failed to delete fingerprint');
            }
          },
        },
      ],
    );
  };

  const handleDeviceCommand = async (deviceId: string, command: string) => {
    try {
      await api.post(`/locations/${locationId}/devices/${deviceId}/command`, { command });
      Alert.alert('Success', `Sent command: ${command}`);
    } catch (error: any) {
      console.error('Failed to execute command', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to execute command');
    }
  };


  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={theme.colors.emerald[500]} />
      </View>
    );
  }

  if (!location) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <Text style={styles.errorText}>Location not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

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
    
    // Check for fraud
    if (todayCheckins.some(c => c.status === 'fraud')) return 'fraud';

    // If they have any success check-in today, they are considered success (đúng giờ)
    const hasSuccess = todayCheckins.some(c => c.status === 'success');
    return hasSuccess ? 'success' : 'late';
  };

  const renderStatusBadge = (status: 'success' | 'late' | 'absent' | 'off_day' | 'fraud') => {
    let bgColor = 'rgba(16, 185, 129, 0.1)';
    let textColor: string = theme.colors.emerald[400];
    let label = 'Đúng giờ';

    if (status === 'late') {
      bgColor = 'rgba(245, 158, 11, 0.1)';
      textColor = theme.colors.amber[400];
      label = 'Muộn';
    } else if (status === 'fraud') {
      bgColor = 'rgba(239, 68, 68, 0.2)';
      textColor = theme.colors.red[500];
      label = 'Gian lận';
    } else if (status === 'absent') {
      bgColor = 'rgba(239, 68, 68, 0.1)';
      textColor = theme.colors.red[400];
      label = 'Nghỉ';
    } else if (status === 'off_day') {
      bgColor = 'rgba(113, 113, 122, 0.1)';
      textColor = '#71717a';
      label = 'Không yêu cầu';
    }

    return (
      <View style={{
        backgroundColor: bgColor,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: textColor + '20',
      }}>
        <Text style={{
          color: textColor,
          fontSize: 10,
          fontWeight: '600',
        }}>{label}</Text>
      </View>
    );
  };

  const isAdmin = user?.role === 'admin' || user?.id === location?.adminId;

  const renderUserItem = ({ item }: { item: UserData }) => (
    <TouchableOpacity 
      style={styles.userCard}
      activeOpacity={0.7}
      onPress={() => (navigation as any).navigate('Check-ins', { filterUser: item.email, filterLocation: location.name })}
    >
      <View style={styles.userInfo}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginRight: 8 }}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={styles.userName}>{item.name}</Text>
            <Text style={styles.userEmail}>{item.email}</Text>
          </View>
          {renderStatusBadge(getUserTodayStatus(item.id))}
        </View>
        {item.fingerprints && item.fingerprints.length > 0 && (
          <View style={styles.fingerprintBadgeContainer}>
            {item.fingerprints.map(f => {
              const matchedDevice = location.devices?.find(d => d.id === f.deviceId);
              const deviceLabel = matchedDevice ? (matchedDevice.name || matchedDevice.clientId) : 'Unknown';
              return (
                <View key={`${f.deviceId}-${f.fingerId}`} style={styles.fingerprintBadge}>
                  <Text style={styles.fingerprintBadgeText}>ID {f.fingerId} ({deviceLabel})</Text>
                  {isAdmin && (
                    <TouchableOpacity
                      onPress={() => handleDeleteFingerprint(f.deviceId, f.fingerId, item.name)}
                      style={styles.deleteFingerprintBtn}
                    >
                      <Trash2 color={theme.colors.red[400]} size={10} style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </View>
      {isAdmin && (
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <TouchableOpacity
            style={[styles.removeBtn, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}
            onPress={() => handleRequestEnrollForUser(item.id)}
          >
            <Fingerprint color={theme.colors.emerald[400]} size={16} />
          </TouchableOpacity>
          {item.id !== user?.id && (
            <TouchableOpacity
              style={styles.removeBtn}
              onPress={() => handleRemoveUser(item.id, item.name)}
            >
              <UserMinus color={theme.colors.red[400]} size={16} />
            </TouchableOpacity>
          )}
        </View>
      )}
    </TouchableOpacity>
  );

  const renderDeviceItem = ({ item }: { item: DeviceData }) => (
    <View style={styles.deviceItemContainer}>
      <View style={styles.deviceRowMain}>
        <View style={styles.userInfo}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={[styles.statusDot, { backgroundColor: item.isOnline ? theme.colors.emerald[400] : theme.colors.zinc[600] }]} />
            <Text style={styles.userName}>{item.name || 'Unnamed Device'}</Text>
          </View>
          <Text style={styles.userEmail}>{item.clientId}</Text>
          {item.ipAddress && (
            <Text style={styles.ipText}>IP: {item.ipAddress}</Text>
          )}
          {item.lastSeenAt && (
            <Text style={styles.lastSeenText}>
              Last Seen: {new Date(item.lastSeenAt).toLocaleTimeString()}
            </Text>
          )}
        </View>
        {isAdmin && (
          <TouchableOpacity
            style={styles.removeBtn}
            onPress={() => handleRemoveDevice(item.id, item.name || item.clientId)}
          >
            <Trash2 color={theme.colors.red[400]} size={16} />
          </TouchableOpacity>
        )}
      </View>

      {isAdmin && item.isOnline && (
        <View style={styles.deviceActionsRow}>
          <TouchableOpacity
            style={styles.cmdBtn}
            onPress={() => handleDeviceCommand(item.id, 'open_door')}
          >
            <Text style={styles.cmdBtnText}>Open Door</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.cmdBtn, { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)' }]}
            onPress={() => {
              if (Platform.OS === 'web') {
                if (window.confirm('Wipe all fingerprints from this hardware device? This cannot be undone.')) {
                  handleDeviceCommand(item.id, 'delete_all_fingers');
                }
                return;
              }
              Alert.alert(
                'Wipe Device',
                'Wipe all fingerprints from this hardware device? This cannot be undone.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Wipe All',
                    style: 'destructive',
                    onPress: () => handleDeviceCommand(item.id, 'delete_all_fingers')
                  }
                ]
              );
            }}
          >
            <Text style={[styles.cmdBtnText, { color: theme.colors.red[400] }]}>Wipe All</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );


  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Back button */}
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <ArrowLeft color={theme.colors.emerald[400]} size={16} />
          <Text style={styles.backText}>Back to Locations</Text>
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.pageHeader}>
          <Users color={theme.colors.emerald[400]} size={24} />
          <View style={styles.pageHeaderText}>
            <Text style={styles.title}>Manage Access</Text>
            <Text style={styles.subtitle}>{location.name}</Text>
          </View>
        </View>

        {enrollMessage ? (
          <View style={styles.enrollMessageCard}>
            <Fingerprint color={theme.colors.emerald[400]} size={20} />
            <Text style={styles.enrollMessageText}>{enrollMessage}</Text>
          </View>
        ) : null}

        {/* Join code info */}
        {location.joinCode && (
          <View style={styles.joinCodeCard}>
            <Text style={styles.joinCodeLabel}>Join Code</Text>
            <Text style={styles.joinCodeValue}>{location.joinCode}</Text>
            <Text style={styles.joinCodeHint}>Share this code so others can join this location.</Text>
          </View>
        )}

        {/* Members list */}
        <View style={[styles.membersCard, { marginBottom: 16 }]}>
          <View style={styles.membersHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.membersTitle}>Assigned Users</Text>
              <Text style={styles.membersCount}>{location.users?.length || 0}</Text>
            </View>
          </View>
          
          {location.users && location.users.length > 0 && (
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name or email..."
              placeholderTextColor={theme.colors.zinc[500]}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          )}

          {(!location.users || location.users.length === 0) ? (
            <View style={styles.emptyMembers}>
              <Text style={styles.emptyText}>
                No users assigned yet. They can join using the Join Code.
              </Text>
            </View>
          ) : (
            <FlatList
              data={location.users.filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase()) || u.email.toLowerCase().includes(searchQuery.toLowerCase()))}
              keyExtractor={(item) => item.id}
              renderItem={renderUserItem}
              scrollEnabled={false}
            />
          )}
        </View>

        {/* Devices list (Admin Only) */}
        {isAdmin && (
          <View style={[styles.membersCard, { marginBottom: 24 }]}>
            <View style={styles.membersHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Cpu color={theme.colors.emerald[400]} size={16} />
                <Text style={[styles.membersTitle, { marginLeft: 8 }]}>Hardware Devices</Text>
              </View>
              {!isAddingDevice && (
                <TouchableOpacity onPress={() => setIsAddingDevice(true)} style={styles.addBtn}>
                  <Plus color={theme.colors.zinc[50]} size={16} />
                </TouchableOpacity>
              )}
            </View>

            {isAddingDevice && (
              <View style={styles.addDeviceForm}>
                <Text style={styles.inputLabel}>Device MAC / Client ID *</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. esp_AABBCCDDEEFF"
                    placeholderTextColor={theme.colors.zinc[500]}
                    value={newDeviceClientId}
                    onChangeText={setNewDeviceClientId}
                    autoCapitalize="none"
                  />
                </View>
                <Text style={styles.inputLabel}>Friendly Name (Optional)</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Main Gate"
                    placeholderTextColor={theme.colors.zinc[500]}
                    value={newDeviceName}
                    onChangeText={setNewDeviceName}
                  />
                </View>
                <View style={styles.formActions}>
                  <TouchableOpacity style={styles.submitBtn} onPress={handleAddDevice}>
                    <Text style={styles.submitBtnText}>Add Device</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsAddingDevice(false)}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {(!location.devices || location.devices.length === 0) ? (
              <View style={styles.emptyMembers}>
                <Text style={styles.emptyText}>
                  No devices registered for this location.
                </Text>
              </View>
            ) : (
              <FlatList
                data={location.devices}
                keyExtractor={(item) => item.id}
                renderItem={renderDeviceItem}
                scrollEnabled={false}
              />
            )}
          </View>
        )}

        {/* SoftAP MAC Scan Logs (Admin Only) */}
        {isAdmin && (
          <View style={styles.scanReportCard}>
            <View style={styles.scanReportHeader}>
              <Wifi color={theme.colors.emerald[400]} size={18} />
              <Text style={styles.scanReportTitle}>SoftAP MAC Scan Logs</Text>
            </View>
            <Text style={styles.scanReportSubtitle}>
              Recent station scan reports from devices scanning local MAC addresses.
            </Text>

            {(!scanReports || scanReports.length === 0) ? (
              <View style={styles.emptyMembers}>
                <Text style={styles.emptyText}>No MAC scan reports found yet.</Text>
              </View>
            ) : (
              <FlatList
                data={scanReports}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                renderItem={({ item }) => {
                  const device = location.devices?.find(d => d.clientId === item.deviceId);
                  const deviceName = device ? (device.name || device.clientId) : item.deviceId;
                  const macList = Array.isArray(item.stations) ? item.stations : [];
                  return (
                    <View style={styles.scanItem}>
                      <View style={styles.scanItemHeader}>
                        <Text style={styles.scanDeviceName}>{deviceName}</Text>
                        <Text style={styles.scanTime}>
                          {new Date(item.scannedAt).toLocaleTimeString()}
                        </Text>
                      </View>
                      <Text style={[styles.emptyText, { textAlign: 'left', fontSize: 12, marginBottom: 4 }]}>
                        Scanned {macList.length} device(s)
                      </Text>
                      {macList.length > 0 && (
                        <View style={styles.macContainer}>
                          {macList.map((mac: string) => (
                            <View key={mac} style={styles.macBadge}>
                              <Text style={styles.macText}>{mac}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                }}
              />
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.zinc[950] },
  container: { flex: 1, padding: theme.spacing.lg },
  centered: { justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.zinc[950] },
  /* Back */
  backBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, marginTop: 8 },
  backText: { color: theme.colors.emerald[400], fontSize: 14, fontWeight: '500', marginLeft: 4 },
  /* Header */
  pageHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20 },
  pageHeaderText: { marginLeft: 10, flex: 1 },
  title: { fontSize: 22, fontWeight: 'bold', color: theme.colors.zinc[50], letterSpacing: -0.3 },
  subtitle: { fontSize: 14, color: theme.colors.zinc[400], marginTop: 2 },
  /* Action Buttons Row */
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  /* Enroll */
  enrollBtn: {
    flex: 1,
    backgroundColor: theme.colors.emerald[500],
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: theme.colors.emerald[500],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  enrollBtnText: {
    color: theme.colors.zinc[50],
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  /* Join code */
  joinCodeCard: {
    backgroundColor: theme.colors.zinc[900], borderRadius: 16, padding: 20,
    borderWidth: 1, borderColor: theme.colors.zinc[800], marginBottom: 16, alignItems: 'center',
  },
  joinCodeLabel: { fontSize: 12, color: theme.colors.zinc[400], marginBottom: 4 },
  joinCodeValue: {
    fontSize: 24, fontWeight: 'bold', color: theme.colors.emerald[400],
    fontFamily: 'monospace', letterSpacing: 4, marginBottom: 8,
  },
  joinCodeHint: { fontSize: 12, color: theme.colors.zinc[500], textAlign: 'center' },
  /* Members */
  membersCard: {
    backgroundColor: theme.colors.zinc[900], borderRadius: 16,
    borderWidth: 1, borderColor: theme.colors.zinc[800], overflow: 'hidden',
  },
  membersHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: theme.colors.zinc[800],
  },
  membersTitle: { fontSize: 15, fontWeight: '600', color: theme.colors.zinc[50] },
  membersCount: {
    fontSize: 13, fontWeight: '500', color: theme.colors.emerald[400],
    backgroundColor: 'rgba(16, 185, 129, 0.1)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999,
  },
  emptyMembers: { padding: 24, alignItems: 'center' },
  emptyText: { fontSize: 14, color: theme.colors.zinc[500], textAlign: 'center', lineHeight: 22 },
  searchInput: {
    backgroundColor: theme.colors.zinc[950],
    borderWidth: 1,
    borderColor: theme.colors.zinc[800],
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.colors.zinc[50],
    fontSize: 14,
    marginBottom: 12,
  },
  /* User item */
  userCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderBottomWidth: 1, borderBottomColor: theme.colors.zinc[800],
  },
  userInfo: { flex: 1 },
  userName: { fontSize: 15, fontWeight: '500', color: theme.colors.zinc[50] },
  userEmail: {
    fontSize: 14,
    color: theme.colors.zinc[400],
    marginTop: 2,
  },
  fingerprintBadgeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  fingerprintBadge: {
    backgroundColor: theme.colors.emerald[500] + '20',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: theme.colors.emerald[500] + '40',
  },
  fingerprintBadgeText: {
    color: theme.colors.emerald[400],
    fontSize: 10,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  deviceCard: { padding: 8, backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 8 },
  removeBtn: { padding: 8, backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 8 },
  /* Error */
  errorText: { color: theme.colors.red[400], textAlign: 'center', marginTop: 40, fontSize: 14 },
  /* Device Form */
  addBtn: {
    padding: 6,
    backgroundColor: theme.colors.zinc[800],
    borderRadius: 8,
  },
  addDeviceForm: {
    padding: 16,
    backgroundColor: 'rgba(24, 24, 27, 0.8)',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.zinc[800],
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.colors.zinc[400],
    marginBottom: 6,
  },
  inputContainer: {
    backgroundColor: theme.colors.zinc[950],
    borderWidth: 1,
    borderColor: theme.colors.zinc[800],
    borderRadius: 10,
    marginBottom: 12,
  },
  input: {
    color: theme.colors.zinc[50],
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  formActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  submitBtn: {
    flex: 1,
    backgroundColor: theme.colors.emerald[500],
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  submitBtnText: {
    color: theme.colors.zinc[50],
    fontSize: 14,
    fontWeight: '600',
  },
  enrollMessageCard: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
    padding: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  enrollMessageText: {
    color: theme.colors.emerald[400],
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  cancelBtn: {
    backgroundColor: theme.colors.zinc[800],
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: theme.colors.zinc[50],
    fontSize: 14,
    fontWeight: '500',
  },
  /* Device actions & details */
  deviceItemContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.zinc[800],
  },
  deviceRowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ipText: {
    fontSize: 12,
    color: theme.colors.zinc[400],
    fontFamily: 'monospace',
    marginTop: 4,
  },
  lastSeenText: {
    fontSize: 11,
    color: theme.colors.zinc[500],
    marginTop: 2,
  },
  deviceActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    paddingTop: 10,
  },
  cmdBtn: {
    flex: 1,
    backgroundColor: theme.colors.zinc[800],
    borderWidth: 1,
    borderColor: theme.colors.zinc[750],
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
  },
  cmdBtnText: {
    color: theme.colors.emerald[400],
    fontSize: 11,
    fontWeight: '600',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  /* Delete fingerprint button inside badge */
  deleteFingerprintBtn: {
    padding: 2,
  },
  /* MAC Scan logs style */
  scanReportCard: {
    backgroundColor: theme.colors.zinc[900],
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.zinc[800],
    padding: 16,
    marginTop: 16,
    marginBottom: 24,
  },
  scanReportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.zinc[800],
    paddingBottom: 8,
  },
  scanReportTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.zinc[50],
    marginLeft: 8,
  },
  scanReportSubtitle: {
    fontSize: 12,
    color: theme.colors.zinc[400],
    marginTop: 2,
    marginBottom: 12,
  },
  scanItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  scanItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  scanDeviceName: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.emerald[400],
  },
  scanTime: {
    fontSize: 11,
    color: theme.colors.zinc[500],
  },
  macContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  macBadge: {
    backgroundColor: theme.colors.zinc[800],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  macText: {
    color: theme.colors.zinc[300],
    fontSize: 10,
    fontFamily: 'monospace',
  },
});
