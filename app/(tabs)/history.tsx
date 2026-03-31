import { useEffect, useState, useCallback, useMemo } from 'react';
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

type StatusFilter = 'all' | 'delivered' | 'exception';
type TimeFilter = 'week' | 'month' | 'all_time';

function startOfWeek(): Date {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function LoadHistoryScreen() {
  const [loads, setLoads] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all_time');

  async function fetchHistory() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); setRefreshing(false); return; }

    const { data, error } = await supabase
      .from('shipments')
      .select('*, vehicles(id, vin, make, model, year, color)')
      .eq('carrier_user_id', user.id)
      .in('status', ['delivered', 'exception', 'cancelled'])
      .order('updated_at', { ascending: false })
      .limit(200);

    if (!error && data) setLoads(data as any);
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => { fetchHistory(); }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchHistory();
  }, []);

  // Apply filters client-side for instant switching
  const filteredLoads = useMemo(() => {
    let result = loads;

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(l => l.status === statusFilter);
    }

    // Time filter
    if (timeFilter === 'week') {
      const since = startOfWeek();
      result = result.filter(l => new Date(l.created_at) >= since);
    } else if (timeFilter === 'month') {
      const since = startOfMonth();
      result = result.filter(l => new Date(l.created_at) >= since);
    }

    return result;
  }, [loads, statusFilter, timeFilter]);

  const totalRevenue = useMemo(() => {
    return filteredLoads.reduce((sum, l) => sum + (l.total_price ? parseFloat(String(l.total_price)) : 0), 0);
  }, [filteredLoads]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Time Filter */}
      <View style={styles.filterRow}>
        {([
          { key: 'week' as TimeFilter, label: 'This Week' },
          { key: 'month' as TimeFilter, label: 'This Month' },
          { key: 'all_time' as TimeFilter, label: 'All Time' },
        ]).map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterBtn, timeFilter === f.key && styles.filterBtnActive]}
            onPress={() => setTimeFilter(f.key)}
          >
            <Text style={[styles.filterText, timeFilter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Status Filter */}
      <View style={[styles.filterRow, { paddingTop: 0 }]}>
        {(['all', 'delivered', 'exception'] as StatusFilter[]).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.statusBtn, statusFilter === f && styles.statusBtnActive]}
            onPress={() => setStatusFilter(f)}
          >
            <Text style={[styles.statusText, statusFilter === f && styles.statusTextActive]}>
              {f === 'all' ? 'All' : f === 'delivered' ? '✅ Delivered' : '⚠ Exception'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Summary Row */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{filteredLoads.length}</Text>
          <Text style={styles.summaryLabel}>Loads Completed</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: colors.success }]}>
            ${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </Text>
          <Text style={styles.summaryLabel}>Total Earned</Text>
        </View>
      </View>

      <FlatList
        style={styles.list}
        data={filteredLoads}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyText}>No loads found</Text>
            <Text style={styles.emptySubtext}>Try changing the filter</Text>
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

  const vehicleDesc = vehicles.length > 0
    ? vehicles.map((v: any) => [v.year, v.make, v.model].filter(Boolean).join(' ')).join(', ')
    : null;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/load/${load.id}`)}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.trackingNum}>{load.tracking_number}</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + '22', borderColor: statusColor + '55' }]}>
          <Text style={[styles.statusText2, { color: statusColor }]}>
            {STATUS_LABELS[load.status] || load.status}
          </Text>
        </View>
      </View>

      {/* Route */}
      <View style={styles.routeRow}>
        <View style={styles.routePoint}>
          <Text style={styles.routeIcon}>📍</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.routeCity}>{load.origin_city}, {load.origin_state}</Text>
          </View>
        </View>
        <Text style={styles.arrow}>→</Text>
        <View style={styles.routePoint}>
          <Text style={styles.routeIcon}>🏁</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.routeCity}>{load.destination_city}, {load.destination_state}</Text>
          </View>
        </View>
      </View>

      {/* Vehicle info */}
      {vehicleDesc && (
        <Text style={styles.vehicleText} numberOfLines={1}>
          🚗 {vehicles.length} vehicle{vehicles.length !== 1 ? 's' : ''}: {vehicleDesc}
        </Text>
      )}

      <View style={styles.cardFooter}>
        <Text style={styles.footerDate}>
          {new Date(load.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
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
    paddingVertical: 8,
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
  filterTextActive: { color: colors.primary, fontWeight: '700' },
  statusBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusBtnActive: {
    backgroundColor: colors.bgCardAlt ?? '#1a2535',
    borderColor: colors.textDim + '66',
  },
  statusText: { fontSize: 11, fontWeight: '600', color: colors.textDim },
  statusTextActive: { color: colors.text, fontWeight: '700' },
  summaryRow: {
    flexDirection: 'row',
    marginHorizontal: 12,
    marginBottom: 8,
    backgroundColor: colors.bgCard,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: 22, fontWeight: '900', color: colors.text },
  summaryLabel: { fontSize: 11, color: colors.textDim, marginTop: 2 },
  summaryDivider: { width: 1, backgroundColor: colors.border, marginHorizontal: 12 },
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
  statusText2: { fontSize: 11, fontWeight: '700' },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  routePoint: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  routeIcon: { fontSize: 13, marginTop: 1 },
  routeCity: { fontSize: 12, fontWeight: '700', color: colors.text },
  arrow: { fontSize: 14, color: colors.textDim, flexShrink: 0 },
  vehicleText: { fontSize: 11, color: colors.textDim, marginBottom: 8 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border },
  footerDate: { fontSize: 11, color: colors.textDim },
  price: { fontSize: 14, fontWeight: '800', color: colors.success },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: '700', color: colors.text },
  emptySubtext: { fontSize: 13, color: colors.textDim, marginTop: 4 },
});
