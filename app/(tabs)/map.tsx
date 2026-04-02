import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Linking, ScrollView,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/colors';

const GOOGLE_MAPS_KEY = 'AIzaSyA-LCcaPwCMdeTYmBmy6JdKp6byDKypHA0';

interface ActiveLoad {
  id: string;
  tracking_number: string;
  status: string;
  origin_city: string;
  origin_state: string;
  destination_city: string;
  destination_state: string;
  origin_lat?: number;
  origin_lng?: number;
  destination_lat?: number;
  destination_lng?: number;
  carrier_rate?: number;
}

function buildMapUrl(
  origin: string,
  destination: string,
  currentLat?: number,
  currentLng?: number
): string {
  const base = 'https://www.google.com/maps/embed/v1/directions';
  const params = new URLSearchParams({
    key: GOOGLE_MAPS_KEY,
    origin,
    destination,
    mode: 'driving',
  });
  return `${base}?${params.toString()}`;
}

function buildCurrentLocationUrl(lat: number, lng: number): string {
  const base = 'https://www.google.com/maps/embed/v1/view';
  const params = new URLSearchParams({
    key: GOOGLE_MAPS_KEY,
    center: `${lat},${lng}`,
    zoom: '13',
    maptype: 'roadmap',
  });
  return `${base}?${params.toString()}`;
}

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const [activeLoad, setActiveLoad] = useState<ActiveLoad | null>(null);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [tracking, setTracking] = useState(false);
  const [mapUrl, setMapUrl] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/(auth)/login'); return; }

      const { data: loads } = await supabase
        .from('shipments')
        .select('id, tracking_number, status, origin_city, origin_state, destination_city, destination_state, origin_lat, origin_lng, destination_lat, destination_lng, carrier_rate')
        .eq('carrier_user_id', session.user.id)
        .in('status', ['assigned', 'picked_up', 'in_transit', 'out_for_delivery'])
        .order('created_at', { ascending: false })
        .limit(1);

      const load = loads?.[0] || null;
      setActiveLoad(load);

      if (load) {
        const origin = `${load.origin_city}, ${load.origin_state}`;
        const destination = `${load.destination_city}, ${load.destination_state}`;
        setMapUrl(buildMapUrl(origin, destination));
      }
    } catch (e) {
      console.warn('Map load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    getLocation();
  }, [loadData]);

  async function getLocation() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
    } catch {}
  }

  async function toggleTracking() {
    if (tracking) {
      setTracking(false);
      return;
    }
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      setTracking(true);
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      setLocation(coords);
      setMapUrl(buildCurrentLocationUrl(coords.latitude, coords.longitude));
      if (activeLoad) {
        await supabase.from('shipments').update({
          current_lat: coords.latitude,
          current_lng: coords.longitude,
          location_updated_at: new Date().toISOString(),
        }).eq('id', activeLoad.id);
      }
    } catch {}
  }

  function openInGoogleMaps() {
    if (!activeLoad) return;
    const origin = encodeURIComponent(`${activeLoad.origin_city}, ${activeLoad.origin_state}`);
    const dest = encodeURIComponent(`${activeLoad.destination_city}, ${activeLoad.destination_state}`);
    Linking.openURL(`https://maps.google.com/maps?saddr=${origin}&daddr=${dest}&dirflg=d`);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.loadingText}>Loading map...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Map */}
      <View style={styles.mapContainer}>
        {mapUrl ? (
          <WebView
            source={{ uri: mapUrl }}
            style={styles.webview}
            javaScriptEnabled
            domStorageEnabled
            startInLoadingState
            renderLoading={() => (
              <View style={styles.center}>
                <ActivityIndicator color={colors.primary} size="large" />
              </View>
            )}
          />
        ) : (
          <View style={[styles.center, { backgroundColor: colors.bgCard }]}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>🗺</Text>
            <Text style={{ color: colors.textMuted, fontSize: 15 }}>No active load</Text>
            <Text style={{ color: colors.textDim, fontSize: 13, marginTop: 4 }}>Accept a load to see your route</Text>
          </View>
        )}
      </View>

      {/* Bottom card */}
      <View style={styles.bottomCard}>
        {activeLoad ? (
          <>
            <View style={styles.loadHeader}>
              <Text style={styles.trackingNum}>{activeLoad.tracking_number}</Text>
              {activeLoad.carrier_rate && (
                <Text style={styles.rate}>${Number(activeLoad.carrier_rate).toLocaleString()}</Text>
              )}
            </View>
            <Text style={styles.route}>
              {activeLoad.origin_city}, {activeLoad.origin_state}
              {'  →  '}
              {activeLoad.destination_city}, {activeLoad.destination_state}
            </Text>

            <View style={styles.btnRow}>
              <TouchableOpacity
                style={[styles.btn, tracking && styles.btnRed]}
                onPress={toggleTracking}
              >
                <Text style={[styles.btnText, tracking && styles.btnTextRed]}>
                  {tracking ? '⏹ STOP TRACKING' : '📍 UPDATE MY LOCATION'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.btnSecondary} onPress={openInGoogleMaps}>
                <Text style={styles.btnSecondaryText}>Open in Maps →</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.noLoadTitle}>NO ACTIVE LOAD</Text>
            <Text style={styles.noLoadSub}>Accept a load to navigate your route</Text>
            <TouchableOpacity style={styles.btn} onPress={() => router.push('/(tabs)/available')}>
              <Text style={styles.btnText}>BROWSE AVAILABLE LOADS</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  loadingText: { color: colors.textMuted, marginTop: 12, fontSize: 14 },
  mapContainer: { flex: 1 },
  webview: { flex: 1, backgroundColor: colors.bg },
  bottomCard: {
    backgroundColor: colors.bgCard,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: 16,
    paddingBottom: 24,
  },
  loadHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  trackingNum: { fontSize: 16, color: colors.primary, fontWeight: '700', letterSpacing: 1 },
  rate: { fontSize: 20, color: '#34d399', fontWeight: '800' },
  route: { fontSize: 14, color: colors.textMuted, marginBottom: 14 },
  btnRow: { flexDirection: 'row', gap: 10 },
  btn: {
    flex: 1, backgroundColor: 'rgba(201,168,76,0.12)', borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.4)', borderRadius: 10,
    paddingVertical: 12, alignItems: 'center',
  },
  btnRed: { backgroundColor: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.4)' },
  btnText: { color: colors.primary, fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  btnTextRed: { color: '#f87171' },
  btnSecondary: {
    flex: 1, backgroundColor: 'rgba(96,165,250,0.1)', borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.3)', borderRadius: 10,
    paddingVertical: 12, alignItems: 'center',
  },
  btnSecondaryText: { color: '#60a5fa', fontSize: 13, fontWeight: '700' },
  noLoadTitle: { fontSize: 16, color: colors.text, fontWeight: '800', letterSpacing: 1.5, marginBottom: 4 },
  noLoadSub: { fontSize: 13, color: colors.textMuted, marginBottom: 16 },
});
