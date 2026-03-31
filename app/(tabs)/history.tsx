import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { colors, statusColors } from '@/lib/colors';
import type { Shipment } from '@/lib/types';

const STATUS_LABELS: Record<string, string> = {
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  exception: 'Exception',
};

export default function LoadHistoryScreen() {
  const [loads, setLoads] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'delivered' | 'exception'>('all');

  async function fetchHistory() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let query = supabase
      .from('shipments')
      .select('*, vehicles(id, vin, make, model, year)')
      .eq('carrier_user_id', user.id)
      .in('status', ['delivered', 'exception', 'cancelled'])
      .order('updated_at', { ascending: false })
      .limit(100);

    if (filter !== 'all') {
      query = query.eq('status', filter);
    }

    const { data, error } = await query;
    if (!error && data) setLoads(data);
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => { fetchHistory(); }, [filter]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchHistory();
  }, [filter]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {(['all', 'delivered', 'exception'] as const).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'all' ? 'All' : f === 'delivered' ? '✅ Delivered' : '⚠ Exception'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        style={styles.list}
        data={loads}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyText}>No completed loads</Text>
            <Text style={styles.emptySubtext}>Completed loads will appear here</Text>
          </View>
        }
        renderItem={({ item }) => <HistoryCard load={item} />}
      />
    </View>
  );
}

function HistoryCard({ load }: { load: Shipment }) {
  const statusColor = statusColors[load.status] || colors.textDim;
  const vehicles = (load as any).vehicles ?? [];

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/load/${load.id}`)}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.trackingNum}>{load.tracking_number}</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + '22', borderColor: statusColor + '55' }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>
            {STATUS_LABELS[load.status] || load.status}
          </Text>
        </View>
      </View>

      <View style={styles.routeRow}>
        <View style={styles.routePoint}>
          <Text style={styles.routeIcon}>📍</Text>
          <View>
            <Text style={styles.routeCity}>{load.origin_city}, {load.origin_state}</Text>
            <Text style={styles.routeAddr} numberOfLines={1}>{load.origin_address}</Text>
          </View>
        </View>
        <Text style={styles.arrow}>→</Text>
        <View style={styles.routePoint}>
          <Text style={styles.routeIcon}>🏁</Text>
          <View>
            <Text style={styles.routeCity}>{load.destination_city}, {load.destination_state}</Text>
            <Text style={styles.routeAddr} numberOfLines={1}>{load.destination_address}</Text>
          </View>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.footerText}>
          {vehicles.length} vehicle{vehicles.length !== 1 ? 's' : ''}
          {vehicles[0] ? ` · ${vehicles[0].year || ''} ${vehicles[0].make || ''}`.trim() : ''}
        </Text>
        {load.total_price ? (
          <Text style={styles.price}>${parseFloat(String(load.total_price)).toLocaleString()}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    paddingBottom: 8,
  },
  filterBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterBtnActive: {
    backgroundColor: colors.primary + '22',
    borderColor: colors.primary + '66',
  },
  filterText: { fontSize: 12, fontWeight: '600', color: colors.textDim },
  filterTextActive: { color: colors.primary },
  list: { flex: 1 },
  card: {
    margin: 12,
    marginBottom: 0,
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  trackingNum: { fontSize: 13, fontWeight: '800', color: colors.text },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1 },
  statusText: { fontSize: 11, fontWeight: '700' },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  routePoint: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  routeIcon: { fontSize: 13, marginTop: 1 },
  routeCity: { fontSize: 12, fontWeight: '700', color: colors.text },
  routeAddr: { fontSize: 11, color: colors.textDim, marginTop: 1 },
  arrow: { fontSize: 14, color: colors.textDim, flexShrink: 0 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border },
  footerText: { fontSize: 11, color: colors.textDim },
  price: { fontSize: 14, fontWeight: '800', color: colors.success },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: '700', color: colors.text },
  emptySubtext: { fontSize: 13, color: colors.textDim, marginTop: 4 },
});
