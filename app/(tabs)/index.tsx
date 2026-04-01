import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Image, Alert, Dimensions, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';

const GOLD = '#C9A84C';
const BG = '#0a0f1a';
const CARD = '#111827';
const BORDER = '#1e2d40';
const TEXT = '#f0f4f8';
const DIM = '#a8c4d8';
const GREEN = '#34d399';
const RED = '#ef4444';
const BEBAS = 'System'; // fallback until font loads

interface ActiveLoad {
  id: string;
  tracking_number: string;
  status: string;
  origin_city: string;
  origin_state: string;
  destination_city: string;
  destination_state: string;
  carrier_rate?: number;
  vehicles?: any[];
}

function statusColor(s: string) {
  if (['delivered','completed'].includes(s)) return GREEN;
  if (['in_transit','picked_up'].includes(s)) return GOLD;
  if (['exception','delayed'].includes(s)) return RED;
  return '#60a5fa';
}

function statusLabel(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [activeLoad, setActiveLoad] = useState<ActiveLoad | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [carrierName, setCarrierName] = useState('Carrier');
  const [stats, setStats] = useState({ total: 0, thisMonth: 0, earnings: 0 });

  const loadData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/(auth)/login'); return; }

      const uid = session.user.id;

      // Get carrier name
      const { data: profile } = await supabase
        .from('carrier_users')
        .select('carrier_name, full_name')
        .eq('id', uid)
        .single();
      if (profile) setCarrierName(profile.carrier_name || profile.full_name || 'Carrier');

      // Get active load
      const { data: loads } = await supabase
        .from('shipments')
        .select('id, tracking_number, status, origin_city, origin_state, destination_city, destination_state, carrier_rate, vehicles')
        .eq('carrier_user_id', uid)
        .in('status', ['assigned', 'picked_up', 'in_transit', 'out_for_delivery'])
        .order('created_at', { ascending: false })
        .limit(1);
      setActiveLoad(loads?.[0] || null);

      // Stats
      const { data: allLoads } = await supabase
        .from('shipments')
        .select('carrier_rate, created_at')
        .eq('carrier_user_id', uid)
        .eq('status', 'delivered');

      if (allLoads) {
        const now = new Date();
        const thisMonth = allLoads.filter(l => {
          const d = new Date(l.created_at);
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });
        setStats({
          total: allLoads.length,
          thisMonth: thisMonth.length,
          earnings: thisMonth.reduce((s, l) => s + (l.carrier_rate || 0), 0),
        });
      }
    } catch (e) {
      console.warn('Load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  if (loading) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={GOLD} size="large" />
        <Text style={{ color: DIM, marginTop: 12, fontSize: 14 }}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GOLD} />}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Image
          source={require('../../assets/logo.png')}
          style={{ width: 120, height: 44, resizeMode: 'contain' }}
        />
        <Text style={styles.greeting}>{carrierName.toUpperCase()}</Text>
      </View>

      {/* Active Load Card */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ACTIVE LOAD</Text>
        {activeLoad ? (
          <View style={styles.loadCard}>
            <View style={styles.loadCardHeader}>
              <Text style={styles.trackingNum}>{activeLoad.tracking_number}</Text>
              <View style={[styles.statusBadge, { backgroundColor: statusColor(activeLoad.status) + '20', borderColor: statusColor(activeLoad.status) + '50' }]}>
                <Text style={[styles.statusText, { color: statusColor(activeLoad.status) }]}>{statusLabel(activeLoad.status)}</Text>
              </View>
            </View>

            <View style={styles.routeRow}>
              <View style={styles.routePoint}>
                <Text style={styles.routeLabel}>PICKUP</Text>
                <Text style={styles.routeCity}>{activeLoad.origin_city}, {activeLoad.origin_state}</Text>
              </View>
              <Text style={styles.routeArrow}>→</Text>
              <View style={styles.routePoint}>
                <Text style={styles.routeLabel}>DELIVERY</Text>
                <Text style={styles.routeCity}>{activeLoad.destination_city}, {activeLoad.destination_state}</Text>
              </View>
            </View>

            {activeLoad.carrier_rate && (
              <Text style={styles.rate}>${activeLoad.carrier_rate.toLocaleString()}</Text>
            )}

            <TouchableOpacity style={styles.mapButton} onPress={() => router.push('/(tabs)/routes')}>
              <Text style={styles.mapButtonText}>📍 VIEW ROUTE DETAILS</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.loadCard, { alignItems: 'center', paddingVertical: 32 }]}>
            <Text style={{ fontSize: 36, marginBottom: 10 }}>🚛</Text>
            <Text style={{ color: DIM, fontFamily: BEBAS, fontSize: 16, letterSpacing: 1 }}>NO ACTIVE LOAD</Text>
            <Text style={{ color: '#556b80', fontSize: 13, marginTop: 4 }}>Check Available Loads for new jobs</Text>
            <TouchableOpacity style={[styles.mapButton, { marginTop: 16 }]} onPress={() => router.push('/(tabs)/available')}>
              <Text style={styles.mapButtonText}>🔍 BROWSE AVAILABLE LOADS</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Stats Row */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>THIS MONTH</Text>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: GOLD }]}>{stats.thisMonth}</Text>
            <Text style={styles.statLabel}>LOADS</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: GREEN }]}>${stats.earnings.toLocaleString()}</Text>
            <Text style={styles.statLabel}>EARNED</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: '#60a5fa' }]}>{stats.total}</Text>
            <Text style={styles.statLabel}>TOTAL LOADS</Text>
          </View>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>
        <View style={styles.actionsGrid}>
          {[
            { icon: '📦', label: 'MY LOADS', route: '/(tabs)/routes' },
            { icon: '🔍', label: 'LOAD BOARD', route: '/(tabs)/available' },
            { icon: '💰', label: 'EARNINGS', route: '/(tabs)/earnings' },
            { icon: '🚗', label: 'MY FLEET', route: '/(tabs)/fleet' },
          ].map((a, i) => (
            <TouchableOpacity key={i} style={styles.actionBtn} onPress={() => router.push(a.route as any)}>
              <Text style={{ fontSize: 24, marginBottom: 6 }}>{a.icon}</Text>
              <Text style={styles.actionLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: { paddingHorizontal: 20, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: BORDER },
  greeting: { fontSize: 14, color: DIM, letterSpacing: 1 },
  section: { paddingHorizontal: 16, paddingTop: 20 },
  sectionTitle: { fontSize: 13, color: GOLD, letterSpacing: 2, fontWeight: '700', marginBottom: 10, textTransform: 'uppercase' },
  loadCard: { backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 14, padding: 16 },
  loadCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  trackingNum: { fontSize: 16, color: '#60a5fa', fontFamily: BEBAS, letterSpacing: 1, fontWeight: '700' },
  statusBadge: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  statusText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  routeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  routePoint: { flex: 1 },
  routeLabel: { fontSize: 11, color: DIM, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 },
  routeCity: { fontSize: 15, color: TEXT, fontWeight: '600' },
  routeArrow: { fontSize: 20, color: BORDER, marginHorizontal: 8 },
  rate: { fontSize: 24, color: GREEN, fontWeight: '800', fontFamily: BEBAS, letterSpacing: 1, marginBottom: 14 },
  mapButton: { backgroundColor: GOLD, borderRadius: 9, paddingVertical: 10, alignItems: 'center' },
  mapButtonText: { color: '#0a0f1a', fontSize: 14, fontWeight: '800', letterSpacing: 1 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 12, padding: 14, alignItems: 'center' },
  statValue: { fontSize: 26, fontWeight: '800', fontFamily: BEBAS, letterSpacing: 1 },
  statLabel: { fontSize: 11, color: DIM, marginTop: 3, letterSpacing: 1, textTransform: 'uppercase' },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionBtn: { flex: 1, minWidth: '45%', backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 12, padding: 16, alignItems: 'center' },
  actionLabel: { fontSize: 12, color: TEXT, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
});
