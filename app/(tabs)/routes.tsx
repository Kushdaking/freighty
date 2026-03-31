import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, TextInput, RefreshControl, Modal,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/colors';
import { computeRouteMatches } from '@/lib/routeMatcher';
import type { RouteMatch, CarrierUser } from '@/lib/types';

const SCORE_COLORS = {
  green: '#22c55e',
  yellow: '#f59e0b',
  red: '#ef4444',
};

const SCORE_LABELS = {
  green: 'Perfect match',
  yellow: 'Minor detour',
  red: 'Worth considering',
};

export default function RoutesScreen() {
  const router = useRouter();
  const [carrier, setCarrier] = useState<CarrierUser | null>(null);
  const [matches, setMatches] = useState<RouteMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [destCity, setDestCity] = useState('');
  const [destState, setDestState] = useState('');

  // Simple city-to-lat/lng lookup cache
  const geoCache = useRef<Record<string, { lat: number; lng: number }>>({});

  useEffect(() => {
    loadCarrier();
  }, []);

  async function loadCarrier() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('carrier_users')
      .select('*')
      .eq('auth_user_id', user.id)
      .single();

    if (data) {
      setCarrier(data);
      setDestCity(data.next_available_location_city ?? '');
      setDestState(data.next_available_location_state ?? '');

      // Auto-load if they already have a destination set
      if (data.next_available_location_lat && data.next_available_location_lng) {
        fetchMatches(data, data.next_available_location_lat, data.next_available_location_lng);
      }
    }
  }

  async function geocodeCity(city: string, state: string): Promise<{ lat: number; lng: number } | null> {
    const key = `${city},${state}`.toLowerCase();
    if (geoCache.current[key]) return geoCache.current[key];

    try {
      const query = encodeURIComponent(`${city}, ${state}, USA`);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`,
        { headers: { 'User-Agent': 'Prevaylos/1.0' } }
      );
      const data = await res.json();
      if (data?.[0]) {
        const result = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
        geoCache.current[key] = result;
        return result;
      }
    } catch (e) {
      console.warn('[routes] geocode failed:', e);
    }
    return null;
  }

  async function fetchMatches(c: CarrierUser | null, destLat: number, destLng: number) {
    const carrierData = c ?? carrier;
    if (!carrierData) return;

    const currentLat = carrierData.current_lat ?? carrierData.home_base_lat;
    const currentLng = carrierData.current_lng ?? carrierData.home_base_lng;

    if (!currentLat || !currentLng) {
      // Can still compute if we have a destination
      return;
    }

    setLoading(true);
    try {
      const results = await computeRouteMatches({
        carrierId: carrierData.id,
        currentLat,
        currentLng,
        destinationLat: destLat,
        destinationLng: destLng,
        maxDeadheadMiles: carrierData.max_deadhead_miles ?? 50,
      });
      setMatches(results);
    } catch (e) {
      console.error('[routes] fetch matches error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleSearch() {
    if (!destCity.trim() || !destState.trim()) return;

    setLoading(true);
    const geo = await geocodeCity(destCity.trim(), destState.trim());
    if (!geo) {
      setLoading(false);
      return;
    }

    // Save to carrier profile
    if (carrier) {
      await supabase
        .from('carrier_users')
        .update({
          next_available_location_city: destCity.trim(),
          next_available_location_state: destState.toUpperCase().slice(0, 2),
          next_available_location_lat: geo.lat,
          next_available_location_lng: geo.lng,
        })
        .eq('id', carrier.id);
    }

    fetchMatches(null, geo.lat, geo.lng);
  }

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (destCity && destState) {
      handleSearch();
    } else {
      setRefreshing(false);
    }
  }, [destCity, destState, carrier]);

  function renderLoadCard({ item }: { item: RouteMatch }) {
    const price = item.total_price ?? item.carrier_rate ?? 0;
    const ratePerMile = item.distance_miles && price
      ? (price / item.distance_miles).toFixed(2)
      : null;
    const dotColor = SCORE_COLORS[item.deadhead_score];
    const vehicle = item.vehicles?.[0];

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.dot, { backgroundColor: dotColor }]} />
          <Text style={[styles.detourText, { color: dotColor }]}>
            {item.total_detour} miles off your route
          </Text>
          <Text style={styles.scoreLabel}>{SCORE_LABELS[item.deadhead_score]}</Text>
        </View>

        <Text style={styles.route}>
          {item.origin_city}, {item.origin_state} → {item.destination_city}, {item.destination_state}
        </Text>

        <View style={styles.cardRow}>
          <View>
            <Text style={styles.price}>
              {price > 0 ? `$${price.toLocaleString()}` : 'Price TBD'}
            </Text>
            {ratePerMile && (
              <Text style={styles.perMile}>${ratePerMile}/mi · {item.distance_miles} mi</Text>
            )}
          </View>
          {vehicle && (
            <View style={styles.vehicleInfo}>
              <Text style={styles.vehicleText}>
                {vehicle.year} {vehicle.make} {vehicle.model}
              </Text>
              <Text style={styles.vehicleCondition}>
                {vehicle.condition} · {vehicle.is_operable ? '✅ Runs' : '⚠️ Inop'}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.detourBreakdown}>
          <Text style={styles.detourSmall}>
            🔼 Pickup detour: {item.pickup_detour_miles} mi
          </Text>
          <Text style={styles.detourSmall}>
            🔽 Delivery detour: {item.delivery_detour_miles} mi
          </Text>
        </View>

        <TouchableOpacity
          style={styles.acceptBtn}
          onPress={() => router.push(`/loads/${item.id}/rate-confirm`)}
        >
          <Text style={styles.acceptBtnText}>Accept Load →</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const hasDestination = destCity.trim() && destState.trim();

  return (
    <View style={styles.container}>
      {/* Destination input */}
      <View style={styles.searchBar}>
        <Text style={styles.searchLabel}>Where are you heading?</Text>
        <View style={styles.searchRow}>
          <TextInput
            style={[styles.input, { flex: 2, marginRight: 8 }]}
            placeholder="City"
            placeholderTextColor={colors.textMuted}
            value={destCity}
            onChangeText={setDestCity}
            autoCapitalize="words"
            returnKeyType="next"
          />
          <TextInput
            style={[styles.input, { flex: 1, marginRight: 8 }]}
            placeholder="ST"
            placeholderTextColor={colors.textMuted}
            value={destState}
            onChangeText={t => setDestState(t.toUpperCase().slice(0, 2))}
            maxLength={2}
            autoCapitalize="characters"
            returnKeyType="search"
            onSubmitEditing={handleSearch}
          />
          <TouchableOpacity
            style={[styles.searchBtn, !hasDestination && styles.searchBtnDisabled]}
            onPress={handleSearch}
            disabled={!hasDestination || loading}
          >
            {loading && !refreshing
              ? <ActivityIndicator size="small" color={colors.white} />
              : <Text style={styles.searchBtnText}>Search</Text>
            }
          </TouchableOpacity>
        </View>
      </View>

      {/* Results */}
      {loading && matches.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Finding loads on your route...</Text>
        </View>
      ) : !hasDestination ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🗺️</Text>
          <Text style={styles.emptyTitle}>Set your destination above to see loads on your route</Text>
          <Text style={styles.emptySubtitle}>
            We'll find loads that fit your path so you're never running empty.
          </Text>
        </View>
      ) : matches.length === 0 && !loading ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🚫</Text>
          <Text style={styles.emptyTitle}>No loads on your route right now</Text>
          <Text style={styles.emptySubtitle}>
            Try increasing your max deadhead miles in Profile settings.
          </Text>
        </View>
      ) : (
        <FlatList
          data={matches}
          keyExtractor={(item) => item.id}
          renderItem={renderLoadCard}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          ListHeaderComponent={
            <Text style={styles.resultsHeader}>
              {matches.length} load{matches.length !== 1 ? 's' : ''} on your route to {destCity}, {destState}
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  searchBar: {
    padding: 16,
    backgroundColor: colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 8,
  },
  searchLabel: { color: colors.text, fontSize: 15, fontWeight: '700' },
  searchRow: { flexDirection: 'row', alignItems: 'center' },
  input: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 14,
  },
  searchBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 72,
  },
  searchBtnDisabled: { opacity: 0.4 },
  searchBtnText: { color: colors.white, fontWeight: '700', fontSize: 14 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: colors.textMuted, fontSize: 14 },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 12,
  },
  emptyIcon: { fontSize: 48 },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtitle: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  list: { padding: 12, gap: 12 },
  resultsHeader: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 10,
    marginBottom: 4,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  detourText: { fontSize: 13, fontWeight: '700' },
  scoreLabel: { color: colors.textMuted, fontSize: 12, marginLeft: 'auto' },
  route: { color: colors.text, fontSize: 16, fontWeight: '800' },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  price: { color: colors.primary, fontSize: 18, fontWeight: '800' },
  perMile: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  vehicleInfo: { alignItems: 'flex-end' },
  vehicleText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  vehicleCondition: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  detourBreakdown: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: colors.bg,
    borderRadius: 8,
    padding: 8,
  },
  detourSmall: { color: colors.textMuted, fontSize: 11 },
  acceptBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  acceptBtnText: { color: colors.white, fontWeight: '700', fontSize: 15 },
});
