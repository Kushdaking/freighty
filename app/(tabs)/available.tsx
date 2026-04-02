import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/colors';
import type { Shipment } from '@/lib/types';

const BOOKMARKS_KEY = 'prevayl_bookmarked_loads';

const ORIGIN_STATES = ['All', 'CA', 'TX', 'FL', 'NY', 'IL', 'PA', 'OH', 'GA', 'NC', 'MI', 'AZ', 'WA', 'CO', 'OR'];
const DEST_STATES = ['All', 'CA', 'TX', 'FL', 'NY', 'IL', 'PA', 'OH', 'GA', 'NC', 'MI', 'AZ', 'WA', 'CO', 'OR'];
const TRANSPORT_TYPES = ['All', 'open', 'enclosed', 'flatbed', 'driveaway'];

export default function AvailableLoadsScreen() {
  const [loads, setLoads] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bookmarks, setBookmarks] = useState<string[]>([]);

  // Filter state
  const [originState, setOriginState] = useState('All');
  const [destState, setDestState] = useState('All');
  const [transportType, setTransportType] = useState('All');

  // Load bookmarks from storage
  useEffect(() => {
    AsyncStorage.getItem(BOOKMARKS_KEY).then(val => {
      if (val) setBookmarks(JSON.parse(val));
    });
  }, []);

  async function fetchAvailable() {
    let query = supabase
      .from('shipments')
      .select('*, vehicles(*)')
      .eq('carrier_status', 'unassigned')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(50);

    if (originState !== 'All') query = query.ilike('origin_state', originState);
    if (destState !== 'All') query = query.ilike('destination_state', destState);
    if (transportType !== 'All') query = query.eq('transport_type', transportType);

    const { data, error } = await query;
    if (!error && data) setLoads(data);
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => {
    setLoading(true);
    fetchAvailable();
  }, [originState, destState, transportType]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAvailable();
  }, [originState, destState, transportType]);

  async function toggleBookmark(id: string) {
    const updated = bookmarks.includes(id)
      ? bookmarks.filter(b => b !== id)
      : [...bookmarks, id];
    setBookmarks(updated);
    await AsyncStorage.setItem(BOOKMARKS_KEY, JSON.stringify(updated));
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Filter Chips */}
      <View style={styles.filtersContainer}>
        {/* Origin State */}
        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>Origin</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chips}>
              {ORIGIN_STATES.map(s => (
                <TouchableOpacity
                  key={`origin-${s}`}
                  style={[styles.chip, originState === s && styles.chipActive]}
                  onPress={() => setOriginState(s)}
                >
                  <Text style={[styles.chipText, originState === s && styles.chipTextActive]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Dest State */}
        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>Destination</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chips}>
              {DEST_STATES.map(s => (
                <TouchableOpacity
                  key={`dest-${s}`}
                  style={[styles.chip, destState === s && styles.chipActive]}
                  onPress={() => setDestState(s)}
                >
                  <Text style={[styles.chipText, destState === s && styles.chipTextActive]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Transport Type */}
        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>Transport</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chips}>
              {TRANSPORT_TYPES.map(t => (
                <TouchableOpacity
                  key={`type-${t}`}
                  style={[styles.chip, transportType === t && styles.chipActive]}
                  onPress={() => setTransportType(t)}
                >
                  <Text style={[styles.chipText, transportType === t && styles.chipTextActive]}>
                    {t === 'All' ? t : t.charAt(0).toUpperCase() + t.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>

      {/* Load List */}
      <FlatList
        style={{ flex: 1 }}
        data={loads}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <Text style={styles.emptyText}>No loads available</Text>
            <Text style={styles.emptySubtext}>Pull to refresh or adjust filters</Text>
          </View>
        }
        renderItem={({ item }) => (
          <AvailableCard
            load={item}
            onRefresh={fetchAvailable}
            isBookmarked={bookmarks.includes(item.id)}
            onToggleBookmark={() => toggleBookmark(item.id)}
          />
        )}
        contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
      />
    </View>
  );
}

function AvailableCard({
  load,
  onRefresh,
  isBookmarked,
  onToggleBookmark,
}: {
  load: Shipment;
  onRefresh: () => void;
  isBookmarked: boolean;
  onToggleBookmark: () => void;
}) {
  const vehicleCount = load.vehicles?.length ?? 0;
  const pricePerMile = load.total_price && load.distance_miles
    ? (load.total_price / load.distance_miles).toFixed(2)
    : null;
  const [marketRate, setMarketRate] = useState<number | null>(null);

  useEffect(() => {
    if (load.origin_state && load.destination_state) {
      fetch('https://app.prevaylos.com/api/pricing/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin_state: load.origin_state,
          destination_state: load.destination_state,
          vehicle_count: vehicleCount || 1,
          distance_miles: load.distance_miles || 500,
          transport_type: load.transport_type || 'open',
          is_expedited: load.is_expedited || false,
          is_cross_border: load.is_cross_border || false,
        }),
      }).then(r => r.json()).then(d => {
        if (d.suggested_price) setMarketRate(d.suggested_price);
      }).catch(() => {});
    }
  }, [load.id]);

  function reviewLoad() {
    router.push({ pathname: '/load/rate-confirm', params: { id: load.id } });
  }

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/load/${load.id}`)}
      activeOpacity={0.75}
    >
      {/* Header */}
      <View style={styles.cardHeader}>
        <Text style={styles.trackingNum}>{load.tracking_number}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {(load as any).vehicles?.some((v: any) => v.high_value_flag) && (
            <View style={styles.highValueBadge}>
              <Text style={styles.highValueText}>💎 HIGH VALUE</Text>
            </View>
          )}
          {load.is_expedited && <Text style={styles.expedited}>⚡ EXP</Text>}
          <TouchableOpacity onPress={onToggleBookmark} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={[styles.bookmark, isBookmarked && styles.bookmarkActive]}>
              {isBookmarked ? '🔖' : '🏷️'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Route */}
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

      {/* Details Row */}
      <View style={styles.details}>
        <Text style={styles.detail}>🚗 {vehicleCount} vehicle{vehicleCount !== 1 ? 's' : ''}</Text>
        {load.distance_miles && <Text style={styles.detail}>📍 {Math.round(load.distance_miles)} mi</Text>}
        {load.scheduled_pickup && (
          <Text style={styles.detail}>
            📅 {new Date(load.scheduled_pickup).toLocaleDateString()}
          </Text>
        )}
        {load.is_cross_border && <Text style={styles.detail}>🇨🇦 XB</Text>}
        <Text style={[styles.detail, { textTransform: 'capitalize' }]}>🚚 {load.transport_type}</Text>
      </View>

      {/* Footer: Price + CTA */}
      <View style={styles.cardFooter}>
        <View>
          {load.total_price ? (
            <>
              <Text style={styles.rate}>${load.total_price.toLocaleString()}</Text>
              {pricePerMile && (
                <Text style={styles.pricePerMile}>${pricePerMile}/mi</Text>
              )}
            </>
          ) : (
            <Text style={styles.rateTbd}>Price TBD</Text>
          )}
          {marketRate && (
            <Text style={{
              fontSize: 11,
              fontWeight: '600',
              marginTop: 2,
              color: load.total_price && load.total_price > marketRate ? '#10b981' : '#ef4444',
            }}>
              Market Rate: ${marketRate.toLocaleString()}
              {load.total_price ? (load.total_price > marketRate ? ' ↑' : ' ↓') : ''}
            </Text>
          )}
        </View>
        <TouchableOpacity style={styles.acceptBtn} onPress={reviewLoad}>
          <Text style={styles.acceptText}>Review & Accept</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8, paddingTop: 60 },
  emptyIcon: { fontSize: 48 },
  emptyText: { color: colors.text, fontSize: 18, fontWeight: '700' },
  emptySubtext: { color: colors.textMuted, fontSize: 14 },

  filtersContainer: {
    backgroundColor: colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingTop: 10,
    paddingBottom: 8,
  },
  filterGroup: {
    marginBottom: 6,
    paddingLeft: 12,
  },
  filterLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  chips: {
    flexDirection: 'row',
    gap: 6,
    paddingRight: 12,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  chipTextActive: {
    color: colors.white,
  },

  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  trackingNum: { color: colors.text, fontWeight: '700', fontSize: 15 },
  expedited: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  highValueBadge: {
    backgroundColor: '#7c3aed22',
    borderWidth: 1,
    borderColor: '#7c3aed',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  highValueText: { color: '#a78bfa', fontSize: 11, fontWeight: '700' },
  bookmark: { fontSize: 18 },
  bookmarkActive: { opacity: 1 },

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
  pricePerMile: { color: colors.textMuted, fontSize: 12, fontWeight: '500', marginTop: 1 },
  rateTbd: { color: colors.textMuted, fontSize: 14 },
  acceptBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  acceptText: { color: colors.white, fontWeight: '700', fontSize: 14 },
});
