import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/colors';
import type { Shipment } from '@/lib/types';

export default function AvailableLoadsScreen() {
  const [loads, setLoads] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchAvailable() {
    const { data, error } = await supabase
      .from('shipments')
      .select('*, vehicles(*)')
      .eq('carrier_status', 'unassigned')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(50);

    if (!error && data) setLoads(data);
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => { fetchAvailable(); }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAvailable();
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
          <Text style={styles.emptyIcon}>🔍</Text>
          <Text style={styles.emptyText}>No loads available</Text>
          <Text style={styles.emptySubtext}>Pull to refresh</Text>
        </View>
      }
      renderItem={({ item }) => <AvailableCard load={item} onRefresh={fetchAvailable} />}
      contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
    />
  );
}

function AvailableCard({ load, onRefresh }: { load: Shipment; onRefresh: () => void }) {
  const [accepting, setAccepting] = useState(false);
  const vehicleCount = load.vehicles?.length ?? 0;

  async function acceptLoad() {
    Alert.alert(
      'Accept Load',
      `Accept load ${load.tracking_number} for $${load.total_price?.toLocaleString() ?? 'TBD'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: async () => {
            setAccepting(true);
            const { data: { user } } = await supabase.auth.getUser();
            const { error } = await supabase
              .from('shipments')
              .update({
                carrier_status: 'accepted',
                carrier_user_id: user?.id,
                carrier_accepted_at: new Date().toISOString(),
              })
              .eq('id', load.id);

            setAccepting(false);
            if (error) {
              Alert.alert('Error', error.message);
            } else {
              Alert.alert('✅ Load Accepted', 'This load is now in your list.');
              onRefresh();
            }
          },
        },
      ]
    );
  }

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/load/${load.id}`)}
      activeOpacity={0.75}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.trackingNum}>{load.tracking_number}</Text>
        {load.is_expedited && <Text style={styles.expedited}>⚡ EXPEDITED</Text>}
      </View>

      <View style={styles.route}>
        <View style={styles.routePoint}>
          <Text style={styles.routeLabel}>PICKUP</Text>
          <Text style={styles.routeCity}>{load.origin_city}, {load.origin_state}</Text>
          <Text style={styles.routeSub}>{load.origin_zip}</Text>
        </View>
        <Text style={styles.arrow}>→</Text>
        <View style={styles.routePoint}>
          <Text style={styles.routeLabel}>DELIVERY</Text>
          <Text style={styles.routeCity}>{load.destination_city}, {load.destination_state}</Text>
          <Text style={styles.routeSub}>{load.destination_zip}</Text>
        </View>
      </View>

      <View style={styles.details}>
        <Text style={styles.detail}>🚗 {vehicleCount} vehicle{vehicleCount !== 1 ? 's' : ''}</Text>
        {load.distance_miles && <Text style={styles.detail}>📍 {Math.round(load.distance_miles)} mi</Text>}
        {load.scheduled_pickup && (
          <Text style={styles.detail}>
            📅 {new Date(load.scheduled_pickup).toLocaleDateString()}
          </Text>
        )}
        {load.is_cross_border && <Text style={styles.detail}>🇨🇦 Cross-Border</Text>}
      </View>

      <View style={styles.cardFooter}>
        {load.total_price && (
          <Text style={styles.rate}>${load.total_price.toLocaleString()}</Text>
        )}
        <TouchableOpacity
          style={[styles.acceptBtn, accepting && styles.btnDisabled]}
          onPress={acceptLoad}
          disabled={accepting}
        >
          {accepting
            ? <ActivityIndicator size="small" color={colors.white} />
            : <Text style={styles.acceptText}>Accept Load</Text>
          }
        </TouchableOpacity>
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
  expedited: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  route: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  routePoint: { flex: 1 },
  routeLabel: { color: colors.textDim, fontSize: 11, fontWeight: '600' },
  routeCity: { color: colors.text, fontSize: 15, fontWeight: '600' },
  routeSub: { color: colors.textMuted, fontSize: 12 },
  arrow: { color: colors.textMuted, fontSize: 18, paddingTop: 12 },
  details: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  detail: { color: colors.textMuted, fontSize: 13 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rate: { color: colors.accent, fontWeight: '800', fontSize: 20 },
  acceptBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  btnDisabled: { opacity: 0.6 },
  acceptText: { color: colors.white, fontWeight: '700', fontSize: 14 },
});
