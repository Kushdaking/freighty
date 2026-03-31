import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { colors, statusColors } from '@/lib/colors';
import type { Shipment } from '@/lib/types';

export default function MyLoadsScreen() {
  const [loads, setLoads] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchLoads() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('shipments')
      .select('*, vehicles(*)')
      .eq('carrier_user_id', user.id)
      .not('carrier_status', 'eq', 'rejected')
      .order('created_at', { ascending: false });

    if (!error && data) setLoads(data);
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => { fetchLoads(); }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchLoads();
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.list}
      data={loads}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📦</Text>
          <Text style={styles.emptyText}>No active loads</Text>
          <Text style={styles.emptySubtext}>Check Available Loads to find work</Text>
        </View>
      }
      renderItem={({ item }) => <LoadCard load={item} />}
      contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
    />
  );
}

function LoadCard({ load }: { load: Shipment }) {
  const vehicleCount = load.vehicles?.length ?? 0;
  const statusColor = statusColors[load.status] ?? colors.textMuted;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/load/${load.id}`)}
      activeOpacity={0.75}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.trackingNum}>{load.tracking_number}</Text>
        <View style={[styles.badge, { backgroundColor: statusColor + '22', borderColor: statusColor }]}>
          <Text style={[styles.badgeText, { color: statusColor }]}>
            {load.status.replace(/_/g, ' ').toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.route}>
        <View style={styles.routePoint}>
          <Text style={styles.routeLabel}>FROM</Text>
          <Text style={styles.routeCity}>{load.origin_city}, {load.origin_state}</Text>
        </View>
        <Text style={styles.arrow}>→</Text>
        <View style={styles.routePoint}>
          <Text style={styles.routeLabel}>TO</Text>
          <Text style={styles.routeCity}>{load.destination_city}, {load.destination_state}</Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.meta}>🚗 {vehicleCount} vehicle{vehicleCount !== 1 ? 's' : ''}</Text>
        {load.distance_miles && (
          <Text style={styles.meta}>{Math.round(load.distance_miles)} mi</Text>
        )}
        {load.carrier_rate && (
          <Text style={styles.rate}>${load.carrier_rate.toLocaleString()}</Text>
        )}
        {load.is_expedited && <Text style={styles.expedited}>⚡ EXPEDITED</Text>}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyIcon: { fontSize: 48 },
  emptyText: { color: colors.text, fontSize: 18, fontWeight: '700' },
  emptySubtext: { color: colors.textMuted, fontSize: 14 },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  trackingNum: { color: colors.text, fontWeight: '700', fontSize: 15 },
  badge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  route: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  routePoint: { flex: 1 },
  routeLabel: { color: colors.textDim, fontSize: 11, fontWeight: '600' },
  routeCity: { color: colors.text, fontSize: 15, fontWeight: '600' },
  arrow: { color: colors.textMuted, fontSize: 18 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  meta: { color: colors.textMuted, fontSize: 13 },
  rate: { marginLeft: 'auto', color: colors.accent, fontWeight: '800', fontSize: 16 },
  expedited: { color: colors.accent, fontSize: 11, fontWeight: '700' },
});
