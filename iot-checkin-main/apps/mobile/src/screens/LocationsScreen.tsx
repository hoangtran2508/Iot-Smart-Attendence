import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator, SafeAreaView,
  RefreshControl, TouchableOpacity, TextInput, Modal, Alert, ScrollView, Platform, Switch
} from 'react-native';
import { api } from '../lib/api';
import { MapPin, Building, Plus, Edit2, Trash2, Users, X, Search, Wifi, CheckCircle, XCircle } from 'lucide-react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { LocationResponse, theme } from 'libs';
import { format } from 'date-fns';
import { getDeviceUuid } from '../lib/device';

interface LocationForm {
  id?: string;
  name: string;
  address: string;
  lat: string;
  lng: string;
  freeAccessEnabled: boolean;
  freeAccessStartTime: string;
  freeAccessEndTime: string;
}

const emptyForm: LocationForm = { name: '', address: '', lat: '', lng: '', freeAccessEnabled: false, freeAccessStartTime: '12:00', freeAccessEndTime: '13:00' };

export const LocationsScreen = () => {
  const { user, token } = useAuth();
  const navigation = useNavigation<any>();
  const [locations, setLocations] = useState<LocationResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [filterText, setFilterText] = useState('');

  // WiFi Check-in State
  const [wifiCheckinStatus, setWifiCheckinStatus] = useState<Record<string, 'idle' | 'fetching_key' | 'validating' | 'success' | 'error'>>({});
  const [wifiCheckinMessage, setWifiCheckinMessage] = useState<Record<string, string>>({});

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState<LocationForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchLocations = async () => {
    try {
      const response = await api.get('/locations');
      setLocations(response.data);
      setError('');
    } catch (err) {
      console.error('Failed to fetch locations:', err);
      setError('Failed to load locations.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchLocations();
      
      if (Platform.OS === 'web') {
        try {
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
        } catch (e) {
          console.error('Failed to parse URL params', e);
        }
      }
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchLocations();
  };

  const filteredLocations = locations.filter(loc => {
    if (!filterText) return true;
    const q = filterText.toLowerCase();
    return loc.name.toLowerCase().includes(q)
      || loc.address?.toLowerCase().includes(q)
      || loc.joinCode?.toLowerCase().includes(q);
  });

  const openCreate = () => {
    setForm(emptyForm);
    setModalVisible(true);
  };

  const openEdit = (loc: LocationResponse) => {
    setForm({
      id: loc.id,
      name: loc.name,
      address: loc.address || '',
      lat: String(loc.lat),
      lng: String(loc.lng),
      freeAccessEnabled: loc.freeAccessEnabled || false,
      freeAccessStartTime: loc.freeAccessStartTime || '12:00',
      freeAccessEndTime: loc.freeAccessEndTime || '13:00',
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      Alert.alert('Error', 'Name is required.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        address: form.address || null,
        lat: parseFloat(form.lat) || 0,
        lng: parseFloat(form.lng) || 0,
        freeAccessEnabled: form.freeAccessEnabled,
        freeAccessStartTime: form.freeAccessStartTime || null,
        freeAccessEndTime: form.freeAccessEndTime || null,
      };
      if (form.id) {
        await api.patch(`/locations/${form.id}`, payload);
      } else {
        await api.post('/locations', payload);
      }
      setModalVisible(false);
      fetchLocations();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to save location.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string, name: string) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`Are you sure you want to delete "${name}"?`)) {
        api.delete(`/locations/${id}`)
          .then(() => fetchLocations())
          .catch((err: any) => Alert.alert('Error', err.response?.data?.message || 'Failed to delete location.'));
      }
      return;
    }

    Alert.alert(
      'Delete Location',
      `Are you sure you want to delete "${name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/locations/${id}`);
              fetchLocations();
            } catch (err: any) {
              Alert.alert('Error', err.response?.data?.message || 'Failed to delete location.');
            }
          },
        },
      ],
    );
  };

  const handleWifiCheckin = async (loc: LocationResponse) => {
    console.log(`[handleWifiCheckin] Triggered for location ${loc.id} (${loc.name})`);
    
    // Auto-discover device IP from location data
    const deviceWithIp = loc.devices?.find(d => d.ipAddress);
    const espIp = deviceWithIp?.ipAddress;

    console.log(`[handleWifiCheckin] Found devices:`, loc.devices);
    console.log(`[handleWifiCheckin] Selected IP:`, espIp);

    if (!espIp) {
      console.warn(`[handleWifiCheckin] No ESP IP found!`);
      // Update UI state so the user sees the error directly on the button
      setWifiCheckinStatus(prev => ({ ...prev, [loc.id]: 'error' }));
      setWifiCheckinMessage(prev => ({ ...prev, [loc.id]: 'Device Offline' }));
      
      // Also show alert for detailed message
      if (Platform.OS !== 'web') {
        Alert.alert('Device Offline', 'No online check-in device found for this location. Please reboot the device or wait for it to connect.');
      }

      setTimeout(() => {
        setWifiCheckinStatus(prev => ({ ...prev, [loc.id]: 'idle' }));
        setWifiCheckinMessage(prev => ({ ...prev, [loc.id]: '' }));
      }, 5000);
      return;
    }

    console.log(`[handleWifiCheckin] Sending checkin request to http://${espIp}/checkin ...`);

    setWifiCheckinStatus(prev => ({ ...prev, [loc.id]: 'fetching_key' }));
    setWifiCheckinMessage(prev => ({ ...prev, [loc.id]: 'Connecting...' }));

    try {
      const deviceUuid = await getDeviceUuid();

      if (Platform.OS === 'web') {
        // Redirect flow for Web/PWA to bypass Mixed Content Blocker
        const callbackUrl = encodeURIComponent(window.location.origin + window.location.pathname);
        window.location.href = `http://${espIp}/checkin?token=${token}&deviceUuid=${deviceUuid}&redirect=${callbackUrl}`;
        return; // Browser will navigate away
      } else {
        // Normal POST fetch for Native apps (ignores Mixed Content Blocker)
        const espUrl = `http://${espIp}/checkin`;
        const checkinResponse = await fetch(espUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            deviceUuid,
          }),
        });

        if (!checkinResponse.ok) {
          const errorData = await checkinResponse.json().catch(() => ({}));
          throw new Error(errorData.error || `ESP returned status ${checkinResponse.status}`);
        }

        setWifiCheckinStatus(prev => ({ ...prev, [loc.id]: 'success' }));
        setWifiCheckinMessage(prev => ({ ...prev, [loc.id]: 'Check-in Sent!' }));

        setTimeout(() => {
          setWifiCheckinStatus(prev => ({ ...prev, [loc.id]: 'idle' }));
          setWifiCheckinMessage(prev => ({ ...prev, [loc.id]: '' }));
        }, 3000);
      }

    } catch (error: any) {
      console.error('WiFi check-in failed:', error);
      const errorMsg = error.response?.data?.message || 'Check-in failed.';
      setWifiCheckinStatus(prev => ({ ...prev, [loc.id]: 'error' }));
      setWifiCheckinMessage(prev => ({ ...prev, [loc.id]: errorMsg }));

      setTimeout(() => {
        setWifiCheckinStatus(prev => ({ ...prev, [loc.id]: 'idle' }));
        setWifiCheckinMessage(prev => ({ ...prev, [loc.id]: '' }));
      }, 5000);
    }
  };

  const renderLocationItem = ({ item }: { item: LocationResponse }) => {
    const isOwner = item.adminId === user?.id;

    return (
      <View style={styles.locationCard}>
        {/* Row 1: Name + badge */}
        <View style={styles.locationHeader}>
          <View style={styles.iconContainer}>
            <Building color={theme.colors.emerald[400]} size={18} />
          </View>
          <Text style={styles.locationName} numberOfLines={1}>{item.name}</Text>
          
          <TouchableOpacity
            style={[styles.wifiBtn, (wifiCheckinStatus[item.id] && wifiCheckinStatus[item.id] !== 'idle') ? { opacity: 0.7 } : null]}
            onPress={() => handleWifiCheckin(item)}
            disabled={!!(wifiCheckinStatus[item.id] && wifiCheckinStatus[item.id] !== 'idle')}
          >
            {wifiCheckinStatus[item.id] === 'fetching_key' || wifiCheckinStatus[item.id] === 'validating' ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : wifiCheckinStatus[item.id] === 'success' ? (
              <CheckCircle color="#fff" size={16} />
            ) : wifiCheckinStatus[item.id] === 'error' ? (
              <XCircle color="#fff" size={16} />
            ) : (
              <Wifi color="#fff" size={16} />
            )}
            <Text style={styles.wifiBtnText}>
              {wifiCheckinStatus[item.id] && wifiCheckinStatus[item.id] !== 'idle' 
                ? wifiCheckinMessage[item.id] 
                : 'Check-in'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Row 2: Badges + Address */}
        <View style={styles.badgesRow}>
          {isOwner ? (
            <View style={styles.ownerBadge}>
              <Text style={styles.ownerBadgeText}>Owner</Text>
            </View>
          ) : (
            <View style={styles.memberBadge}>
              <Text style={styles.memberBadgeText}>Member</Text>
            </View>
          )}
        </View>

        {item.address ? (
          <Text style={styles.addressText}>{item.address}</Text>
        ) : null}

        {/* Row 3: Meta */}
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <MapPin color={theme.colors.zinc[500]} size={12} />
            <Text style={styles.metaText}>{item.lat.toFixed(4)}, {item.lng.toFixed(4)}</Text>
          </View>
          {item.joinCode ? (
            <View style={styles.codeBadge}>
              <Text style={styles.codeText}>{item.joinCode}</Text>
            </View>
          ) : null}
        </View>

        {/* Row 4: Date + Actions */}
        <View style={styles.actionsRow}>
          <Text style={styles.dateText}>
            Created {format(new Date(item.createdAt), 'MMM d, yyyy')}
          </Text>
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => navigation.navigate('LocationDetail', { locationId: item.id })}
            >
              <Users color={theme.colors.blue[400]} size={16} />
            </TouchableOpacity>
            {(isOwner || user?.role === 'admin') && (
              <>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => openEdit(item)}
                >
                  <Edit2 color={theme.colors.emerald[400]} size={16} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => handleDelete(item.id, item.name)}
                >
                  <Trash2 color={theme.colors.red[400]} size={16} />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>
    );
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
        {/* Header + Add button */}
        <View style={styles.headerRow}>
          <View style={styles.pageHeader}>
            <MapPin color={theme.colors.emerald[400]} size={24} />
            <View style={styles.pageHeaderText}>
              <Text style={styles.title}>Locations</Text>
              <Text style={styles.subtitle}>Manage all physical check-in locations.</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.addButton} onPress={openCreate} activeOpacity={0.8}>
            <Plus color="#fff" size={16} />
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        </View>

        {/* Filter */}
        <View style={styles.filterInput}>
          <Search color={theme.colors.zinc[500]} size={14} style={styles.filterIcon} />
          <TextInput
            style={styles.filterText}
            placeholder="Search locations..."
            placeholderTextColor={theme.colors.zinc[500]}
            value={filterText}
            onChangeText={setFilterText}
            autoCapitalize="none"
          />
        </View>

        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : filteredLocations.length === 0 ? (
          <View style={styles.emptyState}>
            <Building color={theme.colors.zinc[700]} size={48} />
            <Text style={styles.emptyStateTitle}>
              {locations.length === 0 ? 'No Locations Found' : 'No results found'}
            </Text>
            <Text style={styles.emptyStateDesc}>
              {locations.length === 0
                ? 'Tap "Add" to create your first location.'
                : 'Try adjusting your search.'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredLocations}
            keyExtractor={(item) => item.id}
            renderItem={renderLocationItem}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={theme.colors.emerald[500]}
                colors={[theme.colors.emerald[500]]}
              />
            }
          />
        )}
      </View>

      {/* Create/Edit Modal */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {form.id ? 'Edit Location' : 'Add Location'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X color={theme.colors.zinc[400]} size={20} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.label}>Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Headquarters"
                placeholderTextColor={theme.colors.zinc[500]}
                value={form.name}
                onChangeText={(v) => setForm({ ...form, name: v })}
              />

              <Text style={styles.label}>Address</Text>
              <TextInput
                style={styles.input}
                placeholder="123 Main St"
                placeholderTextColor={theme.colors.zinc[500]}
                value={form.address}
                onChangeText={(v) => setForm({ ...form, address: v })}
              />

              <View style={styles.coordRow}>
                <View style={styles.coordField}>
                  <Text style={styles.label}>Latitude *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="37.7749"
                    placeholderTextColor={theme.colors.zinc[500]}
                    value={form.lat}
                    onChangeText={(v) => setForm({ ...form, lat: v })}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.coordField}>
                  <Text style={styles.label}>Longitude *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="-122.4194"
                    placeholderTextColor={theme.colors.zinc[500]}
                    value={form.lng}
                    onChangeText={(v) => setForm({ ...form, lng: v })}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.switchRow}>
                <View>
                  <Text style={styles.label}>Enable Free Access</Text>
                  <Text style={styles.subLabel}>Automatically open door during specific hours</Text>
                </View>
                <Switch
                  value={form.freeAccessEnabled}
                  onValueChange={(v) => setForm({ ...form, freeAccessEnabled: v })}
                  trackColor={{ false: theme.colors.zinc[700], true: theme.colors.emerald[500] }}
                />
              </View>

              {form.freeAccessEnabled && (
                <View style={styles.coordRow}>
                  <View style={styles.coordField}>
                    <Text style={styles.label}>Start Time</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="12:00"
                      placeholderTextColor={theme.colors.zinc[500]}
                      value={form.freeAccessStartTime}
                      onChangeText={(v) => setForm({ ...form, freeAccessStartTime: v })}
                    />
                  </View>
                  <View style={styles.coordField}>
                    <Text style={styles.label}>End Time</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="13:00"
                      placeholderTextColor={theme.colors.zinc[500]}
                      value={form.freeAccessEndTime}
                      onChangeText={(v) => setForm({ ...form, freeAccessEndTime: v })}
                    />
                  </View>
                </View>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.5 }]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.zinc[950] },
  container: { flex: 1, padding: theme.spacing.lg },
  centered: { justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.zinc[950] },
  /* Header */
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, marginTop: 8 },
  pageHeader: { flexDirection: 'row', alignItems: 'flex-start', flex: 1 },
  pageHeaderText: { marginLeft: 10, flex: 1 },
  title: { fontSize: 22, fontWeight: 'bold', color: theme.colors.zinc[50], letterSpacing: -0.3 },
  subtitle: { fontSize: 14, color: theme.colors.zinc[400], marginTop: 2 },
  addButton: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: theme.colors.emerald[500], paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: theme.borderRadius.lg,
    shadowColor: theme.colors.emerald[500], shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4,
  },
  addButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  /* Filter */
  filterInput: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.colors.zinc[900], borderWidth: 1, borderColor: theme.colors.zinc[800],
    borderRadius: theme.borderRadius.lg, paddingHorizontal: 10, marginBottom: 16,
  },
  filterIcon: { marginRight: 6 },
  filterText: { flex: 1, paddingVertical: 10, color: theme.colors.zinc[50], fontSize: 13 },
  listContainer: { paddingBottom: theme.spacing.lg },
  /* Location card */
  locationCard: {
    backgroundColor: theme.colors.zinc[900], borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: theme.colors.zinc[800], marginBottom: 12,
  },
  locationHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  iconContainer: { backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: 6, borderRadius: 6, marginRight: 10 },
  locationName: { fontSize: 16, fontWeight: '600', color: theme.colors.zinc[50], flex: 1, marginRight: 8 },
  wifiBtn: { 
    flexDirection: 'row', alignItems: 'center', gap: 6, 
    backgroundColor: '#3b82f6', paddingHorizontal: 12, paddingVertical: 6, 
    borderRadius: 8 
  },
  wifiBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  badgesRow: { flexDirection: 'row', marginBottom: 8, paddingLeft: 34 },
  ownerBadge: { backgroundColor: 'rgba(168, 85, 247, 0.1)', borderWidth: 1, borderColor: 'rgba(168, 85, 247, 0.2)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9999, alignSelf: 'flex-start' },
  ownerBadgeText: { fontSize: 11, fontWeight: '500', color: theme.colors.purple[400] },
  memberBadge: { backgroundColor: theme.colors.zinc[800], borderWidth: 1, borderColor: theme.colors.zinc[700], paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9999 },
  memberBadgeText: { fontSize: 11, fontWeight: '500', color: theme.colors.zinc[400] },
  addressText: { fontSize: 13, color: theme.colors.zinc[400], marginBottom: 10, paddingLeft: 34 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: theme.colors.zinc[800], paddingTop: 10 },
  metaItem: { flexDirection: 'row', alignItems: 'center' },
  metaText: { fontSize: 12, color: theme.colors.zinc[500], marginLeft: 4, fontFamily: 'monospace' },
  codeBadge: { backgroundColor: 'rgba(16, 185, 129, 0.1)', borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.2)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  codeText: { fontSize: 12, fontWeight: '600', color: theme.colors.emerald[400], fontFamily: 'monospace' },
  dateText: { fontSize: 11, color: theme.colors.zinc[500] },
  /* Actions */
  actionsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  actionButtons: { flexDirection: 'row', gap: 4 },
  actionBtn: { padding: 8, backgroundColor: theme.colors.zinc[800], borderRadius: 8 },
  /* Modal */
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: theme.colors.zinc[900], borderRadius: 16, borderWidth: 1, borderColor: theme.colors.zinc[800], maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: theme.colors.zinc[800] },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: theme.colors.zinc[50] },
  modalBody: { padding: 20 },
  label: { fontSize: 13, fontWeight: '500', color: theme.colors.zinc[400], marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: theme.colors.zinc[950], borderWidth: 1, borderColor: theme.colors.zinc[800], borderRadius: theme.borderRadius.lg, padding: 12, color: theme.colors.zinc[50], fontSize: 15 },
  coordRow: { flexDirection: 'row', gap: 12 },
  coordField: { flex: 1 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: theme.colors.zinc[800] },
  subLabel: { fontSize: 11, color: theme.colors.zinc[500], marginTop: 2 },
  modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, padding: 20, borderTopWidth: 1, borderTopColor: theme.colors.zinc[800] },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10 },
  cancelBtnText: { color: theme.colors.zinc[400], fontSize: 14, fontWeight: '500' },
  saveBtn: { backgroundColor: theme.colors.emerald[500], paddingHorizontal: 20, paddingVertical: 10, borderRadius: theme.borderRadius.lg },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  /* Empty */
  errorText: { color: theme.colors.red[400], textAlign: 'center', marginTop: 40, fontSize: 14 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  emptyStateTitle: { fontSize: 18, fontWeight: '600', color: theme.colors.zinc[50], marginTop: 16, marginBottom: 8 },
  emptyStateDesc: { fontSize: 14, color: theme.colors.zinc[400], textAlign: 'center', lineHeight: 22 },
});
