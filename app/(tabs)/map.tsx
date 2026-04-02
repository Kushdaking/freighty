import { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Platform, Dimensions, Alert,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/colors';

const { width, height } = Dimensions.get('window');

const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0a0f1a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#a8c4d8' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0a0f1a' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1e2d40' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2a3f5a' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#C9A84C' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#06111f' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#1a2a3a' }] },
  { featureType: 'administrative.country', elementType: 'labels.text.fill', stylers: [{ color: '#6a8aaa' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#a8c4d8' }] },
];

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

interface GeoPoint {
  lat: number;
  lng: number;
}

async function geocode(city: string, state: string): Promise<GeoPoint | null> {
  try {
    const q = encodeURIComponent(`${city}, ${state}, USA`);
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`, {
      headers: { 'User-Agent': 'Prevaylos/1.0' },
    });
    const data = await res.json();
    if (data?.[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {}
  return null;
}

export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [activeLoad, setActiveLoad] = useState<ActiveLoad | null>(null);
  const [originCoord, setOriginCoord] = useState<GeoPoint | null>(null);
  const [destCoord, setDestCoord] = useState<GeoPoint | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [locationGranted, setLocationGranted] = useState(false);
  const [tracking, setTracking] = useState(false);
  const locationSub = useRef<Location.LocationSubscription | null>(null);

  const loadData = useCallback(async () => {
    try {
      // Get current user's active load
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
        // Use stored coords or geocode
        const origin: GeoPoint = load.origin_lat && load.origin_lng
          ? { lat: load.origin_lat, lng: load.origin_lng }
          : await geocode(load.origin_city, load.origin_state) ?? { lat: 34.0522, lng: -118.2437 };

        const dest: GeoPoint = load.destination_lat && load.destination_lng
          ? { lat: load.destination_lat, lng: load.destination_lng }
          : await geocode(load.destination_city, load.destination_state) ?? { lat: 40.7128, lng: -74.006 };

        setOriginCoord(origin);
        setDestCoord(dest);

        // Fit map to show both points
        setTimeout(() => {
          mapRef.current?.fitToCoordinates(
            [
              { latitude: origin.lat, longitude: origin.lng },
              { latitude: dest.lat, longitude: dest.lng },
            ],
            { edgePadding: { top: 100, right: 60, bottom: 200, left: 60 }, animated: true }
          );
        }, 500);
      }
    } catch (e) {
      console.warn('Map load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    return () => { locationSub.current?.remove(); };
  }, [loadData]);

  // Only request location after map is ready to avoid grey screen crash
  useEffect(() => {
    if (mapReady) requestLocation();
  }, [mapReady]);

  async function requestLocation() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      setLocationGranted(true);
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
    }
  }

  async function startTracking() {
    if (!locationGranted) {
      Alert.alert('Location Required', 'Enable location permissions to track your route.');
      return;
    }
    setTracking(true);
    locationSub.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, distanceInterval: 50, timeInterval: 30000 },
      async (loc) => {
        const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        setLocation(coords);
        // Update dispatch with current position
        if (activeLoad) {
          await supabase.from('shipments').update({
            current_lat: coords.latitude,
            current_lng: coords.longitude,
            location_updated_at: new Date().toISOString(),
          }).eq('id', activeLoad.id);
        }
      }
    );
  }

  function stopTracking() {
    locationSub.current?.remove();
    locationSub.current = null;
    setTracking(false);
  }

  function centerOnMe() {
    if (location) {
      mapRef.current?.animateToRegion({
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }, 800);
    }
  }

  function fitToRoute() {
    if (originCoord && destCoord) {
      mapRef.current?.fitToCoordinates(
        [
          { latitude: originCoord.lat, longitude: originCoord.lng },
          { latitude: destCoord.lat, longitude: destCoord.lng },
        ],
        { edgePadding: { top: 100, right: 60, bottom: 200, left: 60 }, animated: true }
      );
    }
  }

  const initialRegion = location
    ? { latitude: location.latitude, longitude: location.longitude, latitudeDelta: 5, longitudeDelta: 5 }
    : { latitude: 37.0902, longitude: -95.7129, latitudeDelta: 30, longitudeDelta: 30 };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading map...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        customMapStyle={DARK_MAP_STYLE}
        initialRegion={initialRegion}
        showsUserLocation={mapReady && locationGranted}
        showsMyLocationButton={false}
        showsTraffic={mapReady}
        showsCompass={false}
        onMapReady={() => setMapReady(true)}
      >
        {/* Origin marker */}
        {originCoord && (
          <Marker
            coordinate={{ latitude: originCoord.lat, longitude: originCoord.lng }}
            title="Pickup"
            description={activeLoad ? `${activeLoad.origin_city}, ${activeLoad.origin_state}` : ''}
          >
            <View style={styles.markerPickup}>
              <Text style={styles.markerIcon}>📦</Text>
            </View>
          </Marker>
        )}

        {/* Destination marker */}
        {destCoord && (
          <Marker
            coordinate={{ latitude: destCoord.lat, longitude: destCoord.lng }}
            title="Delivery"
            description={activeLoad ? `${activeLoad.destination_city}, ${activeLoad.destination_state}` : ''}
          >
            <View style={styles.markerDest}>
              <Text style={styles.markerIcon}>🏁</Text>
            </View>
          </Marker>
        )}

        {/* Route line */}
        {originCoord && destCoord && (
          <Polyline
            coordinates={[
              { latitude: originCoord.lat, longitude: originCoord.lng },
              ...(location ? [{ latitude: location.latitude, longitude: location.longitude }] : []),
              { latitude: destCoord.lat, longitude: destCoord.lng },
            ]}
            strokeColor={colors.primary}
            strokeWidth={3}
            lineDashPattern={[10, 6]}
          />
        )}
      </MapView>

      {/* Active load card */}
      {activeLoad ? (
        <View style={styles.loadCard}>
          <View style={styles.loadCardHeader}>
            <Text style={styles.trackingNum}>{activeLoad.tracking_number}</Text>
            <Text style={styles.rate}>
              {activeLoad.carrier_rate ? `$${Number(activeLoad.carrier_rate).toLocaleString()}` : ''}
            </Text>
          </View>
          <Text style={styles.route}>
            {activeLoad.origin_city}, {activeLoad.origin_state}
            {'  →  '}
            {activeLoad.destination_city}, {activeLoad.destination_state}
          </Text>

          {/* Track button */}
          <TouchableOpacity
            style={[styles.trackBtn, tracking && styles.trackBtnActive]}
            onPress={tracking ? stopTracking : startTracking}
          >
            <Text style={[styles.trackBtnText, tracking && styles.trackBtnTextActive]}>
              {tracking ? '⏹ STOP TRACKING' : '📍 START TRACKING DISPATCH'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.noLoadCard}>
          <Text style={styles.noLoadTitle}>NO ACTIVE LOAD</Text>
          <Text style={styles.noLoadSub}>Accept a load to see your route here</Text>
          <TouchableOpacity style={styles.browseBtn} onPress={() => router.push('/(tabs)/available')}>
            <Text style={styles.browseBtnText}>Browse Available Loads</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Map controls */}
      <View style={styles.controls}>
        <TouchableOpacity style={styles.controlBtn} onPress={centerOnMe}>
          <Text style={styles.controlIcon}>📍</Text>
        </TouchableOpacity>
        {originCoord && destCoord && (
          <TouchableOpacity style={styles.controlBtn} onPress={fitToRoute}>
            <Text style={styles.controlIcon}>🗺</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  map: { width, height },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  loadingText: { color: colors.textMuted, marginTop: 12, fontSize: 14 },

  // Load card
  loadCard: {
    position: 'absolute', bottom: 20, left: 16, right: 16,
    backgroundColor: colors.bgCard, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border,
    padding: 16, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 12, elevation: 8,
  },
  loadCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  trackingNum: { fontSize: 16, color: colors.primary, fontWeight: '700', letterSpacing: 1, fontFamily: 'System' },
  rate: { fontSize: 20, color: '#34d399', fontWeight: '800', letterSpacing: 0.5 },
  route: { fontSize: 14, color: colors.textMuted, marginBottom: 14 },

  trackBtn: {
    backgroundColor: 'rgba(201,168,76,0.12)',
    borderWidth: 1, borderColor: 'rgba(201,168,76,0.4)',
    borderRadius: 10, paddingVertical: 12, alignItems: 'center',
  },
  trackBtnActive: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderColor: 'rgba(239,68,68,0.4)',
  },
  trackBtnText: { color: colors.primary, fontSize: 13, fontWeight: '800', letterSpacing: 1 },
  trackBtnTextActive: { color: '#f87171' },

  // No load card
  noLoadCard: {
    position: 'absolute', bottom: 20, left: 16, right: 16,
    backgroundColor: colors.bgCard, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border,
    padding: 20, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 12, elevation: 8,
  },
  noLoadTitle: { fontSize: 16, color: colors.text, fontWeight: '800', letterSpacing: 1.5, marginBottom: 4 },
  noLoadSub: { fontSize: 13, color: colors.textMuted, marginBottom: 16 },
  browseBtn: {
    backgroundColor: colors.primary, borderRadius: 10,
    paddingVertical: 10, paddingHorizontal: 24,
  },
  browseBtnText: { color: colors.bg, fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },

  // Controls
  controls: {
    position: 'absolute', right: 16, bottom: 180,
    gap: 10,
  },
  controlBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 8, elevation: 4,
  },
  controlIcon: { fontSize: 20 },

  // Markers
  markerPickup: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(201,168,76,0.2)',
    borderWidth: 2, borderColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  markerDest: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(52,211,153,0.2)',
    borderWidth: 2, borderColor: '#34d399',
    alignItems: 'center', justifyContent: 'center',
  },
  markerIcon: { fontSize: 20 },
});
