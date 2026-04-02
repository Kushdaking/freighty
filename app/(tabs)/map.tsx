import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Linking, Platform, ScrollView,
} from 'react-native';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/colors';

interface ActiveLoad {
  id: string;
  tracking_number: string;
  status: string;
  origin_city: string;
  origin_state: string;
  destination_city: string;
  destination_state: string;
  carrier_rate?: number;
  pickup_address?: string;
  delivery_address?: string;
}

function statusColor(s: string) {
  if (['delivered', 'completed'].includes(s)) return '#34d399';
  if (['in_transit', 'picked_up'].includes(s)) return colors.primary;
  if (['exception', 'delayed'].includes(s)) return '#ef4444';
  return '#60a5fa';
}

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const [loads, setLoads] = useState<ActiveLoad[]>([]);
  const [loading, setLoading] = useState(true);
  const [tracking, setTracking] = useState(false);
  const [currentLoad, setCurrentLoad] = useState<ActiveLoad | null>(null);

  const loadData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/(auth)/login'); return; }

      const { data } = await supabase
        .from('shipments')
        .select('id, tracking_number, status, origin_city, origin_state, destination_city, destination_state, carrier_rate, pickup_address, delivery_address')
        .eq('carrier_user_id', session.user.id)
        .in('status', ['assigned', 'picked_up', 'in_transit', 'out_for_delivery'])
        .order('created_at', { ascending: false })
        .limit(5);

      setLoads(data ?? []);
      if (data && data.length > 0) setCurrentLoad(data[0]);
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  function getDestination(load: ActiveLoad, forPickup: boolean): string {
    if (forPickup) {
      return load.pickup_address || `${load.origin_city}, ${load.origin_state}`;
    }
    return load.delivery_address || `${load.destination_city}, ${load.destination_state}`;
  }

  function openGoogleMaps(destination: string) {
    const encoded = encodeURIComponent(destination);
    const url = Platform.OS === 'ios'
      ? `comgooglemaps://?daddr=${encoded}&directionsmode=driving`
      : `google.navigation:q=${encoded}&mode=d`;
    
    Linking.canOpenURL(url).then(supported => {
      if (supported) {
        Linking.openURL(url);
      } else {
        // Fallback to browser Google Maps
        Linking.openURL(`https://maps.google.com/maps?daddr=${encoded}&dirflg=d`);
      }
    });
  }

  function openWaze(destination: string) {
    const encoded = encodeURIComponent(destination);
    const url = `waze://?q=${encoded}&navigate=yes`;
    Linking.canOpenURL(url).then(supported => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Linking.openURL(`https://waze.com/ul?q=${encoded}&navigate=yes`);
      }
    });
  }

  function openCoPilot(destination: string) {
    const encoded = encodeURIComponent(destination);
    // CoPilot Truck deep link — routes for truck height/weight/hazmat
    const url = `copilot://directions?dest=${encoded}&vehicletype=truck`;
    Linking.canOpenURL(url).then(supported => {
      if (supported) {
        Linking.openURL(url);
      } else {
        // CoPilot not installed — send to Play Store
        Linking.openURL('https://play.google.com/store/apps/details?id=com.alk.copilot.mapphone');
      }
    });
  }

  function openAppleMaps(destination: string) {
    const encoded = encodeURIComponent(destination);
    Linking.openURL(`maps://?daddr=${encoded}&dirflg=d`);
  }

  async function updateLocation(load: ActiveLoad) {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      setTracking(true);
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      await supabase.from('shipments').update({
        current_lat: loc.coords.latitude,
        current_lng: loc.coords.longitude,
        location_updated_at: new Date().toISOString(),
      }).eq('id', load.id);
      setTracking(false);
      alert('✅ Location updated — dispatch can see your position');
    } catch {
      setTracking(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (loads.length === 0) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>🗺</Text>
        <Text style={styles.noLoadTitle}>NO ACTIVE LOADS</Text>
        <Text style={styles.noLoadSub}>Accept a load to get navigation</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/(tabs)/available')}>
          <Text style={styles.primaryBtnText}>BROWSE AVAILABLE LOADS</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { paddingTop: insets.top }]} contentContainerStyle={{ paddingBottom: 40 }}>
      
      {/* Load selector if multiple */}
      {loads.length > 1 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SELECT LOAD</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {loads.map(load => (
                <TouchableOpacity
                  key={load.id}
                  onPress={() => setCurrentLoad(load)}
                  style={[styles.loadChip, currentLoad?.id === load.id && styles.loadChipActive]}
                >
                  <Text style={[styles.loadChipText, currentLoad?.id === load.id && styles.loadChipTextActive]}>
                    {load.tracking_number}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      {currentLoad && (
        <>
          {/* Load info */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.trackingNum}>{currentLoad.tracking_number}</Text>
              <View style={[styles.statusBadge, { backgroundColor: statusColor(currentLoad.status) + '20', borderColor: statusColor(currentLoad.status) + '50' }]}>
                <Text style={[styles.statusText, { color: statusColor(currentLoad.status) }]}>
                  {currentLoad.status.replace(/_/g, ' ').toUpperCase()}
                </Text>
              </View>
            </View>
            <View style={styles.routeRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.routeLabel}>PICKUP</Text>
                <Text style={styles.routeCity}>{currentLoad.origin_city}, {currentLoad.origin_state}</Text>
              </View>
              <Text style={styles.arrow}>→</Text>
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={styles.routeLabel}>DELIVERY</Text>
                <Text style={styles.routeCity}>{currentLoad.destination_city}, {currentLoad.destination_state}</Text>
              </View>
            </View>
            {currentLoad.carrier_rate && (
              <Text style={styles.rate}>${Number(currentLoad.carrier_rate).toLocaleString()}</Text>
            )}
          </View>

          {/* Navigate to Pickup */}
          <Text style={styles.sectionLabel}>NAVIGATE TO PICKUP</Text>
          <View style={styles.navGrid}>
            <TouchableOpacity style={styles.navBtn} onPress={() => openGoogleMaps(getDestination(currentLoad, true))}>
              <Text style={styles.navIcon}>🗺</Text>
              <Text style={styles.navLabel}>Google Maps</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navBtn} onPress={() => openWaze(getDestination(currentLoad, true))}>
              <Text style={styles.navIcon}>🔵</Text>
              <Text style={styles.navLabel}>Waze</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.navBtn, styles.navBtnTruck]} onPress={() => openCoPilot(getDestination(currentLoad, true))}>
              <Text style={styles.navIcon}>🚛</Text>
              <Text style={[styles.navLabel, { color: '#f59e0b' }]}>CoPilot{`\n`}Truck</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.truckHint}>⚠️ CoPilot routes by truck height, weight & bridge clearances</Text>

          {/* Navigate to Delivery */}
          <Text style={styles.sectionLabel}>NAVIGATE TO DELIVERY</Text>
          <View style={styles.navGrid}>
            <TouchableOpacity style={[styles.navBtn, styles.navBtnGold]} onPress={() => openGoogleMaps(getDestination(currentLoad, false))}>
              <Text style={styles.navIcon}>🗺</Text>
              <Text style={[styles.navLabel, { color: colors.primary }]}>Google Maps</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.navBtn, styles.navBtnGold]} onPress={() => openWaze(getDestination(currentLoad, false))}>
              <Text style={styles.navIcon}>🔵</Text>
              <Text style={[styles.navLabel, { color: colors.primary }]}>Waze</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.navBtn, styles.navBtnTruck]} onPress={() => openCoPilot(getDestination(currentLoad, false))}>
              <Text style={styles.navIcon}>🚛</Text>
              <Text style={[styles.navLabel, { color: '#f59e0b' }]}>CoPilot{`\n`}Truck</Text>
            </TouchableOpacity>
          </View>

          {/* Update location for dispatch */}
          <TouchableOpacity
            style={styles.trackBtn}
            onPress={() => updateLocation(currentLoad)}
            disabled={tracking}
          >
            <Text style={styles.trackBtnText}>
              {tracking ? '📡 UPDATING DISPATCH...' : '📍 PING MY LOCATION TO DISPATCH'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.hint}>
            Tapping a nav button opens Google Maps or Waze with turn-by-turn directions. "Ping Location" sends your GPS coordinates to the dispatcher dashboard.
          </Text>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: 20 },
  section: { marginBottom: 20 },
  sectionLabel: { fontSize: 13, color: colors.primary, letterSpacing: 2, fontWeight: '700', marginBottom: 10, marginTop: 16, textTransform: 'uppercase' },

  card: { backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 16, marginBottom: 20 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  trackingNum: { fontSize: 17, color: colors.primary, fontWeight: '700', letterSpacing: 1 },
  statusBadge: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  routeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  routeLabel: { fontSize: 11, color: colors.textDim, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 },
  routeCity: { fontSize: 15, color: colors.text, fontWeight: '600' },
  arrow: { fontSize: 20, color: colors.border, marginHorizontal: 8 },
  rate: { fontSize: 24, color: '#34d399', fontWeight: '800', letterSpacing: 0.5 },

  navGrid: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  navBtn: {
    flex: 1, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, padding: 16, alignItems: 'center', gap: 8,
  },
  navBtnGold: { borderColor: 'rgba(201,168,76,0.3)', backgroundColor: 'rgba(201,168,76,0.06)' },
  navIcon: { fontSize: 28 },
  navLabel: { fontSize: 12, color: colors.text, fontWeight: '700', letterSpacing: 0.5 },

  trackBtn: {
    backgroundColor: 'rgba(96,165,250,0.1)', borderWidth: 1, borderColor: 'rgba(96,165,250,0.3)',
    borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16,
  },
  trackBtnText: { color: '#60a5fa', fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },

  loadChip: { backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  loadChipActive: { backgroundColor: 'rgba(201,168,76,0.15)', borderColor: colors.primary },
  loadChipText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  loadChipTextActive: { color: colors.primary },

  noLoadTitle: { fontSize: 18, color: colors.text, fontWeight: '800', letterSpacing: 1.5, marginBottom: 6 },
  noLoadSub: { fontSize: 14, color: colors.textMuted, marginBottom: 24 },
  primaryBtn: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 28 },
  primaryBtnText: { color: colors.bg, fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },

  hint: { fontSize: 12, color: colors.textDim, textAlign: 'center', marginTop: 16, lineHeight: 18 },
  truckHint: { fontSize: 11, color: '#f59e0b', textAlign: 'center', marginBottom: 4, marginTop: -4 },
  navBtnTruck: { borderColor: 'rgba(245,158,11,0.3)', backgroundColor: 'rgba(245,158,11,0.06)' },
});
