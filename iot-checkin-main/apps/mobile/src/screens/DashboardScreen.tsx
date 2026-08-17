import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, SafeAreaView, ScrollView } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { LayoutDashboard, LogIn, Activity, ShieldCheck, LogOut, CheckCircle } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import { theme } from 'libs';

export const DashboardScreen = () => {
  const { user, logout } = useAuth();
  const [joinCode, setJoinCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [joinSuccess, setJoinSuccess] = useState(false);

  const [stats, setStats] = useState({ checkinsCount: 0, locationsCount: 0 });

  const fetchStats = async () => {
    try {
      const [locationsRes, checkinsRes] = await Promise.all([
        api.get('/locations'),
        api.get('/checkins')
      ]);
      setStats({
        locationsCount: locationsRes.data.length,
        checkinsCount: checkinsRes.data.length,
      });
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchStats();
    }, [])
  );

  const handleJoinLocation = async () => {
    if (!joinCode.trim()) return;

    setIsJoining(true);
    setJoinSuccess(false);

    try {
      await api.post('/locations/join', { code: joinCode.toUpperCase() });
      setJoinSuccess(true);
      setJoinCode('');
      fetchStats();
      Alert.alert('Success', 'You have successfully joined the location.');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to join location');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {/* Header — matches dashboard "Welcome back, {name}!" */}
        <View style={styles.headerSection}>
          <View style={styles.headerLeft}>
            <Text style={styles.welcomeText}>
              Welcome back, {user?.name || user?.email}!
            </Text>
            <Text style={styles.subtitleText}>
              Here's what's happening with your IoT check-ins today.
            </Text>
          </View>
          <TouchableOpacity onPress={logout} style={styles.logoutButton} activeOpacity={0.7}>
            <LogOut color={theme.colors.red[400]} size={20} />
          </TouchableOpacity>
        </View>

        {/* Cards grid — matches dashboard 4-column overview */}
        <View style={styles.cardsGrid}>
          {/* Card 1: Recent Activity */}
          <View style={styles.overviewCard}>
            <View style={[styles.iconCircle, { backgroundColor: 'rgba(96, 165, 250, 0.1)' }]}>
              <Activity color={theme.colors.blue[400]} size={28} />
            </View>
            <Text style={styles.cardTitle}>Check-ins</Text>
            <Text style={styles.cardStat}>{stats.checkinsCount}</Text>
            <Text style={styles.cardDesc}>Total check-ins</Text>
          </View>

          {/* Card 2: Manage Access */}
          <View style={styles.overviewCard}>
            <View style={[styles.iconCircle, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
              <ShieldCheck color={theme.colors.emerald[400]} size={28} />
            </View>
            <Text style={styles.cardTitle}>Locations</Text>
            <Text style={styles.cardStat}>{stats.locationsCount}</Text>
            <Text style={styles.cardDesc}>Active locations</Text>
          </View>
        </View>

        {/* Join a Location card — matches dashboard overview card */}
        <View style={styles.joinCard}>
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(251, 191, 36, 0.1)', alignSelf: 'center' }]}>
            <LogIn color={theme.colors.amber[400]} size={28} />
          </View>
          <Text style={styles.joinTitle}>Join a Location</Text>
          <Text style={styles.joinDesc}>Enter a code to join</Text>

          <View style={styles.joinInputRow}>
            <TextInput
              style={styles.joinInput}
              placeholder="e.g. A4X9T2"
              placeholderTextColor={theme.colors.zinc[500]}
              value={joinCode}
              onChangeText={(text) => setJoinCode(text.toUpperCase())}
              maxLength={6}
              autoCapitalize="characters"
            />
          </View>

          <TouchableOpacity
            style={[styles.joinButton, (!joinCode || isJoining) && styles.joinButtonDisabled]}
            onPress={handleJoinLocation}
            disabled={!joinCode || isJoining}
            activeOpacity={0.8}
          >
            {isJoining ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.joinButtonText}>Join Location</Text>
            )}
          </TouchableOpacity>

          {joinSuccess && (
            <View style={styles.successMessage}>
              <CheckCircle color={theme.colors.emerald[400]} size={14} />
              <Text style={styles.successText}>Successfully joined!</Text>
            </View>
          )}
        </View>

        {/* System Status — matches dashboard overview card */}
        <View style={styles.statusCard}>
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(168, 85, 247, 0.1)', alignSelf: 'center' }]}>
            <LayoutDashboard color={theme.colors.purple[400]} size={28} />
          </View>
          <Text style={styles.statusTitle}>System Status</Text>
          <Text style={styles.statusDesc}>All systems operational</Text>
          <View style={styles.statusBadge}>
            <View style={styles.statusDot} />
            <Text style={styles.statusBadgeText}>Online</Text>
          </View>
        </View>
      </ScrollView>
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
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: 40,
  },
  /* Header */
  headerSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 28,
    marginTop: 8,
  },
  headerLeft: {
    flex: 1,
    marginRight: 16,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.zinc[50],
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  subtitleText: {
    fontSize: 14,
    color: theme.colors.zinc[400],
    lineHeight: 20,
  },
  logoutButton: {
    padding: 10,
    backgroundColor: theme.colors.zinc[900],
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.zinc[800],
  },
  /* Cards Grid */
  cardsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  overviewCard: {
    flex: 1,
    backgroundColor: theme.colors.zinc[900],
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.zinc[800],
    padding: 20,
    alignItems: 'center',
  },
  iconCircle: {
    padding: 14,
    borderRadius: 9999,
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.zinc[100],
    marginBottom: 4,
  },
  cardStat: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.zinc[50],
    marginBottom: 2,
  },
  cardDesc: {
    fontSize: 12,
    color: theme.colors.zinc[400],
  },
  /* Join Card */
  joinCard: {
    backgroundColor: theme.colors.zinc[900],
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.zinc[800],
    padding: 24,
    marginBottom: 12,
  },
  joinTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.colors.zinc[100],
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  joinDesc: {
    fontSize: 13,
    color: theme.colors.zinc[400],
    textAlign: 'center',
    marginBottom: 16,
  },
  joinInputRow: {
    marginBottom: 10,
  },
  joinInput: {
    backgroundColor: theme.colors.zinc[950],
    borderWidth: 1,
    borderColor: theme.colors.zinc[800],
    borderRadius: theme.borderRadius.lg,
    padding: 14,
    color: theme.colors.zinc[50],
    fontSize: 16,
    letterSpacing: 3,
    textAlign: 'center',
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  joinButton: {
    backgroundColor: theme.colors.emerald[500],
    paddingVertical: 12,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    shadowColor: theme.colors.emerald[500],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  joinButtonDisabled: {
    opacity: 0.5,
  },
  joinButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  successMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  successText: {
    color: theme.colors.emerald[400],
    marginLeft: 6,
    fontSize: 13,
    fontWeight: '500',
  },
  /* Status Card */
  statusCard: {
    backgroundColor: theme.colors.zinc[900],
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.zinc[800],
    padding: 24,
    marginBottom: 12,
  },
  statusTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.colors.zinc[100],
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  statusDesc: {
    fontSize: 13,
    color: theme.colors.zinc[400],
    textAlign: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.emerald[400],
    marginRight: 6,
  },
  statusBadgeText: {
    color: theme.colors.emerald[400],
    fontSize: 13,
    fontWeight: '500',
  },
});
