import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Platform,
  Linking,
  Alert,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

function PrevaylLogo({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id="hgold" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#D4AF5A" />
          <Stop offset="1" stopColor="#A8832A" />
        </LinearGradient>
      </Defs>
      <Path d="M50 8 C30 8 14 24 14 44 C14 64 50 92 50 92 C50 92 86 64 86 44 C86 24 70 8 50 8 Z" fill="url(#hgold)" />
      <Circle cx={50} cy={44} r={14} fill="#0a0f1a" />
      <Circle cx={50} cy={44} r={6} fill="#C9A84C" />
      <Path d="M30 30 L50 44" stroke="#ffffff" strokeWidth={2} strokeDasharray="3,3" opacity={0.5} />
      <Path d="M50 44 L70 35" stroke="#ffffff" strokeWidth={2} strokeDasharray="3,3" opacity={0.5} />
    </Svg>
  );
}
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Workaround for typing in older RN type definitions
const AView = Animated.View as unknown as React.ComponentType<any>;
const AMapView = MapView as unknown as React.ComponentType<any>;
const AMarker = Marker as unknown as React.ComponentType<any>;

const COLLAPSED_HEIGHT = 160;
const EXPANDED_HEIGHT = Math.round(SCREEN_HEIGHT * 0.65);

const US_CENTER = { latitude: 39.5, longitude: -98.35, latitudeDelta: 30, longitudeDelta: 30 };

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#0a0f1a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#a8c4d8' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0a0f1a' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1e2d40' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2E4057' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#C9A84C' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0d1520' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
];

interface Coords { latitude: number; longitude: number }

interface POI {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: 'truck_stop' | 'rest_area';
  distance: number;
}

interface ActiveLoad {
  id: string;
  tracking_number: string;
  status: string;
  origin_city: string;
  origin_state: string;
  origin_zip: string;
  destination_city: string;
  destination_state: string;
  destination_zip: string;
  carrier_rate: number | null;
  origin_lat: number | null;
  origin_lng: number | null;
  destination_lat: number | null;
  destination_lng: number | null;
  vehicles: any[];
  notes: string | null;
  scheduled_pickup: string | null;
  estimated_delivery: string | null;
}

async function geocodeCity(city: string, state: string): Promise<Coords | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}+${encodeURIComponent(state)}&format=json&limit=1&countrycodes=us`,
      { headers: { 'User-Agent': 'PrevaylCarrierApp/1.0' } }
    );
    const data = await res.json();
    if (data[0]) return { latitude: parseFloat(data[0].lat), longitude: parseFloat(data[0].lon) };
  } catch {}
  return null;
}

function getDistanceMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function fetchNearbyPOI(lat: number, lng: number): Promise<POI[]> {
  try {
    const radius = 16093;
    const query = `[out:json][timeout:15];(
      node["amenity"="fuel"]["hgv"="yes"](around:${radius},${lat},${lng});
      node["amenity"="rest_area"](around:${radius},${lat},${lng});
      node["amenity"="truck_stop"](around:${radius},${lat},${lng});
      node["name"~"Pilot|Flying J|Love's|TA |TravelCenters|Petro |Sapp Bros|Kwik Trip",i](around:${radius},${lat},${lng});
    );out body;`;
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: query,
    });
    const data = await res.json();
    return (data.elements || []).slice(0, 10).map((el: any) => ({
      id: String(el.id),
      name: el.tags?.name || el.tags?.operator || 'Truck Stop',
      lat: el.lat,
      lng: el.lon,
      type: el.tags?.amenity === 'rest_area' ? 'rest_area' : 'truck_stop',
      distance: getDistanceMiles(lat, lng, el.lat, el.lon),
    }));
  } catch {
    return [];
  }
}

function openNavigation(lat: number | null, lng: number | null, address: string) {
  const dest = lat && lng ? `${lat},${lng}` : encodeURIComponent(address);
  if (Platform.OS === 'ios') {
    Linking.openURL(`comgooglemaps://?daddr=${dest}&directionsmode=driving`).catch(() =>
      Linking.openURL(`maps://app?daddr=${dest}`)
    );
  } else {
    Linking.openURL(`google.navigation:q=${dest}`);
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return 'TBD';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function statusLabel(s: string): string {
  return s.replace(/_/g, ' ').toUpperCase();
}

function statusColor(s: string): string {
  const map: Record<string, string> = {
    accepted: '#16a34a',
    picked_up: '#2563eb',
    in_transit: '#2563eb',
    out_for_delivery: '#7c3aed',
  };
  return map[s] || '#f59e0b';
}

export default function MapHomeScreen() {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<any>(null);

  const [userLocation, setUserLocation] = useState<Coords | null>(null);
  const [carrierId, setCarrierId] = useState<string | null>(null);
  const [carrierName, setCarrierName] = useState<string>('DISPATCH');
  const [activeLoad, setActiveLoad] = useState<ActiveLoad | null>(null);
  const [originCoords, setOriginCoords] = useState<Coords | null>(null);
  const [destCoords, setDestCoords] = useState<Coords | null>(null);
  const [pois, setPois] = useState<POI[]>([]);
  const [loadingLoad, setLoadingLoad] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  const sheetAnim = useRef(new Animated.Value(COLLAPSED_HEIGHT)).current;
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);
  const lastLocationUpdate = useRef<number>(0);
  const firstFix = useRef(true);

  // ── Carrier + active load ──────────────────────────────────────────────────

  const loadActiveLoad = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) { setLoadingLoad(false); return; }

    const { data: carrier } = await supabase
      .from('carrier_users')
      .select('id, name, company_name, current_lat, current_lng')
      .eq('email', user.email)
      .maybeSingle();

    if (carrier) {
      setCarrierId(carrier.id);
      setCarrierName(carrier.company_name || carrier.name || 'DISPATCH');
    }

    const cid = carrier?.id ?? user.id;

    const { data } = await supabase
      .from('shipments')
      .select(
        'id, tracking_number, status, origin_city, origin_state, origin_zip, destination_city, destination_state, destination_zip, carrier_rate, origin_lat, origin_lng, destination_lat, destination_lng, vehicles(*), notes, scheduled_pickup, estimated_delivery'
      )
      .eq('carrier_user_id', cid)
      .in('status', ['accepted', 'picked_up', 'in_transit', 'out_for_delivery'])
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      setActiveLoad(data as ActiveLoad);
      await resolveLoadCoords(data as ActiveLoad);
    }
    setLoadingLoad(false);
  }, []);

  const resolveLoadCoords = async (load: ActiveLoad) => {
    let origin: Coords | null = null;
    let dest: Coords | null = null;

    if (load.origin_lat && load.origin_lng) {
      origin = { latitude: load.origin_lat, longitude: load.origin_lng };
    } else if (load.origin_city && load.origin_state) {
      origin = await geocodeCity(load.origin_city, load.origin_state);
    }

    if (load.destination_lat && load.destination_lng) {
      dest = { latitude: load.destination_lat, longitude: load.destination_lng };
    } else if (load.destination_city && load.destination_state) {
      dest = await geocodeCity(load.destination_city, load.destination_state);
    }

    setOriginCoords(origin);
    setDestCoords(dest);
  };

  // ── Location tracking ──────────────────────────────────────────────────────

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
      } catch (permErr) {
        console.warn('Location permission error:', permErr);
        return;
      }

      // Small delay to let the permission dialog fully dismiss before starting GPS
      await new Promise(resolve => setTimeout(resolve, 500));
      if (!mounted) return;

      try {
        locationSubRef.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Low, timeInterval: 10000, distanceInterval: 50 },
          (loc) => {
            if (!mounted) return;
            const coords: Coords = {
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
            };
            setUserLocation(coords);

            // Animate camera on first fix
            if (firstFix.current) {
              firstFix.current = false;
              mapRef.current?.animateToRegion(
                { ...coords, latitudeDelta: 0.15, longitudeDelta: 0.15 },
                1200
              );
              // Fetch nearby POIs
              fetchNearbyPOI(coords.latitude, coords.longitude).then(setPois);
            }

            // Supabase update every 60s
            const now = Date.now();
            if (carrierId && now - lastLocationUpdate.current > 60000) {
              lastLocationUpdate.current = now;
              supabase
                .from('carrier_users')
                .update({ current_lat: coords.latitude, current_lng: coords.longitude })
                .eq('id', carrierId)
                .then(() => {});
            }
          }
        );
      } catch (locErr) {
        console.warn('Location watch failed:', locErr);
      }
    })();

    return () => {
      mounted = false;
      locationSubRef.current?.remove();
    };
  }, [carrierId]);

  useEffect(() => {
    loadActiveLoad();
  }, [loadActiveLoad]);

  // ── Bottom sheet toggle ────────────────────────────────────────────────────

  const toggleSheet = () => {
    const toValue = isExpanded ? COLLAPSED_HEIGHT : EXPANDED_HEIGHT;
    setIsExpanded(!isExpanded);
    Animated.spring(sheetAnim, {
      toValue,
      useNativeDriver: false,
      tension: 60,
      friction: 10,
    }).start();
  };

  // ── Status update ──────────────────────────────────────────────────────────

  const updateLoadStatus = async (shipmentId: string, newStatus: string) => {
    const { error } = await supabase
      .from('shipments')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', shipmentId);
    if (!error) {
      await supabase.from('shipment_events').insert({
        shipment_id: shipmentId,
        event_type: `status_${newStatus}`,
        description: `Carrier updated status to ${newStatus}`,
        event_time: new Date().toISOString(),
      });
      loadActiveLoad();
    }
  };

  const handleReportIssue = () => {
    if (!activeLoad) return;
    Alert.alert('Report Issue', 'Select issue type', [
      { text: 'Vehicle Damage', onPress: () => updateLoadStatus(activeLoad.id, 'exception') },
      { text: 'Delay', onPress: () => updateLoadStatus(activeLoad.id, 'delayed') },
      { text: 'Wrong Address', style: 'default', onPress: () => {} },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // ── Vehicle label ──────────────────────────────────────────────────────────

  const vehicleLabel = (() => {
    const v = activeLoad?.vehicles?.[0];
    if (!v) return null;
    return [v.year, v.make, v.model].filter(Boolean).join(' ');
  })();

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* MAP — full screen background */}
      <AMapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={US_CENTER}
        showsUserLocation={false}
        customMapStyle={darkMapStyle}
        showsCompass={false}
        showsMyLocationButton={false}
      >
        {/* Route markers */}
        {originCoords && activeLoad && (
          <AMarker coordinate={originCoords} anchor={{ x: 0.5, y: 1 }}>
            <View style={styles.markerOrigin}>
              <Text style={styles.markerEmoji}>📍</Text>
              <Text style={styles.markerLabel}>
                {activeLoad.origin_city}, {activeLoad.origin_state}
              </Text>
            </View>
          </AMarker>
        )}
        {destCoords && activeLoad && (
          <AMarker coordinate={destCoords} anchor={{ x: 0.5, y: 1 }}>
            <View style={styles.markerDest}>
              <Text style={styles.markerEmoji}>🏁</Text>
              <Text style={styles.markerLabelDest}>
                {activeLoad.destination_city}, {activeLoad.destination_state}
              </Text>
            </View>
          </AMarker>
        )}
        {/* Route polyline */}
        {originCoords && destCoords && (
          <Polyline
            coordinates={[originCoords, destCoords]}
            strokeColor="#C9A84C"
            strokeWidth={3}
            lineDashPattern={[12, 8]}
          />
        )}
        {/* POI markers */}
        {pois.map((poi: POI) => (
          <AMarker
            key={poi.id}
            coordinate={{ latitude: poi.lat, longitude: poi.lng }}
            anchor={{ x: 0.5, y: 0.5 }}
            onPress={() => openNavigation(poi.lat, poi.lng, poi.name)}
          >
            <View style={styles.poiMarker}>
              <Text style={styles.poiMarkerEmoji}>
                {poi.type === 'rest_area' ? '😴' : '🚛'}
              </Text>
            </View>
          </AMarker>
        ))}
      </AMapView>

      {/* HEADER BAR */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerLeft}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <PrevaylLogo size={26} />
            <Text style={styles.headerBrand}>PREVAYL</Text>
          </View>
          <Text style={styles.headerSub}>{carrierName.toUpperCase()}</Text>
        </View>
        <View style={styles.headerCenter}>
          {activeLoad ? (
            <>
              <Text style={styles.trackingNum}>{activeLoad.tracking_number}</Text>
              <View style={[styles.statusBadge, { backgroundColor: statusColor(activeLoad.status) }]}>
                <Text style={styles.statusBadgeText}>{statusLabel(activeLoad.status)}</Text>
              </View>
            </>
          ) : (
            <Text style={styles.headerNoLoad}>No Active Load</Text>
          )}
        </View>
        <TouchableOpacity style={styles.headerBell}>
          <Text style={styles.bellIcon}>🔔</Text>
        </TouchableOpacity>
      </View>

      {/* POI STRIP */}
      {pois.length > 0 && (
        <AView style={[styles.poiStrip, { bottom: sheetAnim }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.poiScroll}>
            {pois.map((poi: POI) => (
              <TouchableOpacity
                key={poi.id}
                style={styles.poiCard}
                onPress={() => openNavigation(poi.lat, poi.lng, poi.name)}
              >
                <Text style={styles.poiCardEmoji}>
                  {poi.type === 'rest_area' ? '😴' : '🚛'}
                </Text>
                <Text style={styles.poiCardName} numberOfLines={1}>
                  {poi.name.substring(0, 12)}
                </Text>
                <Text style={styles.poiCardDist}>{poi.distance.toFixed(1)} mi</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </AView>
      )}

      {/* BOTTOM SHEET */}
      <AView style={[styles.bottomSheet, { height: sheetAnim }]}>
        {/* Handle */}
        <TouchableOpacity style={styles.handleArea} onPress={toggleSheet}>
          <View style={styles.handle} />
          <Text style={styles.chevron}>{isExpanded ? '▼' : '▲'}</Text>
        </TouchableOpacity>

        {loadingLoad ? (
          <View style={styles.sheetCenter}>
            <ActivityIndicator color="#C9A84C" />
          </View>
        ) : activeLoad ? (
          <ScrollView showsVerticalScrollIndicator={false} style={styles.sheetScroll}>
            {/* EXPANDED CONTENT */}
            {isExpanded && (
              <View style={styles.expandedContent}>
                {/* Route */}
                <View style={styles.routeRow}>
                  <View style={styles.routeCol}>
                    <Text style={styles.routeLabel}>📍 PICKUP</Text>
                    <Text style={styles.routeCity}>
                      {activeLoad.origin_city}, {activeLoad.origin_state}
                    </Text>
                    <Text style={styles.routeMeta}>{activeLoad.origin_zip}</Text>
                    <Text style={styles.routeMeta}>
                      {formatDate(activeLoad.scheduled_pickup)}
                    </Text>
                  </View>
                  <Text style={styles.routeArrow}>→</Text>
                  <View style={styles.routeCol}>
                    <Text style={styles.routeLabel}>🏁 DELIVERY</Text>
                    <Text style={styles.routeCity}>
                      {activeLoad.destination_city}, {activeLoad.destination_state}
                    </Text>
                    <Text style={styles.routeMeta}>{activeLoad.destination_zip}</Text>
                    <Text style={styles.routeMeta}>
                      {formatDate(activeLoad.estimated_delivery)}
                    </Text>
                  </View>
                </View>

                {vehicleLabel && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>🚗 VEHICLE</Text>
                    <Text style={styles.detailValue}>{vehicleLabel}</Text>
                  </View>
                )}

                {activeLoad.notes ? (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>📝 NOTES</Text>
                    <Text style={styles.detailValue}>{activeLoad.notes}</Text>
                  </View>
                ) : null}

                {/* Big pay display */}
                {activeLoad.carrier_rate != null && (
                  <View style={styles.payBanner}>
                    <Text style={styles.payLabel}>CARRIER PAY</Text>
                    <Text style={styles.payAmount}>
                      ${activeLoad.carrier_rate.toLocaleString()}
                    </Text>
                  </View>
                )}

                {/* Expanded action buttons */}
                <View style={styles.actionGrid}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnBlue]}
                    onPress={() => updateLoadStatus(activeLoad.id, 'picked_up')}
                  >
                    <Text style={styles.actionBtnText}>✅ Mark Picked Up</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnGreen]}
                    onPress={() => updateLoadStatus(activeLoad.id, 'delivered')}
                  >
                    <Text style={styles.actionBtnText}>🏁 Mark Delivered</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnGold]}
                    onPress={() => router.push('/bol-upload' as any)}
                  >
                    <Text style={styles.actionBtnText}>📸 Upload BOL</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnRed]}
                    onPress={handleReportIssue}
                  >
                    <Text style={styles.actionBtnText}>⚠️ Report Issue</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* COLLAPSED CONTENT (always visible) */}
            <View style={styles.collapsedContent}>
              <View style={styles.collapsedRow1}>
                <Text style={styles.collapsedTracking}>{activeLoad.tracking_number}</Text>
                <Text style={styles.collapsedRoute}>
                  {activeLoad.origin_city}, {activeLoad.origin_state} → {activeLoad.destination_city}, {activeLoad.destination_state}
                </Text>
              </View>
              <View style={styles.collapsedRow2}>
                {activeLoad.carrier_rate != null && (
                  <Text style={styles.collapsedPay}>💰 ${activeLoad.carrier_rate.toLocaleString()}</Text>
                )}
                <View style={[styles.statusBadge, { backgroundColor: statusColor(activeLoad.status) }]}>
                  <Text style={styles.statusBadgeText}>{statusLabel(activeLoad.status)}</Text>
                </View>
              </View>
              <View style={styles.quickActions}>
                <TouchableOpacity
                  style={styles.quickBtn}
                  onPress={() =>
                    openNavigation(
                      destCoords?.latitude ?? null,
                      destCoords?.longitude ?? null,
                      `${activeLoad.destination_city}, ${activeLoad.destination_state}`
                    )
                  }
                >
                  <Text style={styles.quickBtnText}>📍 Navigate</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.quickBtn}
                  onPress={() => Linking.openURL('tel:+18005551234')}
                >
                  <Text style={styles.quickBtnText}>📞 Call</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.quickBtn}
                  onPress={() => router.push('/bol-upload' as any)}
                >
                  <Text style={styles.quickBtnText}>📸 BOL</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        ) : (
          <View style={styles.noLoadContent}>
            <Text style={styles.noLoadText}>No active load</Text>
            <TouchableOpacity
              style={styles.browseBtn}
              onPress={() => router.push('/(tabs)/available')}
            >
              <Text style={styles.browseBtnText}>Browse Available Loads →</Text>
            </TouchableOpacity>
          </View>
        )}
      </AView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0f1a',
  },

  // ── Header ──
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: 'rgba(10,15,26,0.85)',
    zIndex: 100,
  },
  headerLeft: {
    flex: 1,
  },
  headerBrand: {
    color: '#C9A84C',
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 1,
  },
  headerSub: {
    color: '#a8c4d8',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  headerCenter: {
    flex: 2,
    alignItems: 'center',
    gap: 4,
  },
  trackingNum: {
    color: '#f1f5f9',
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  headerNoLoad: {
    color: '#64748b',
    fontSize: 13,
  },
  headerBell: {
    flex: 1,
    alignItems: 'flex-end',
  },
  bellIcon: {
    fontSize: 20,
  },

  // ── Status badge ──
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // ── Markers ──
  markerOrigin: {
    alignItems: 'center',
    backgroundColor: 'rgba(37,99,235,0.9)',
    borderRadius: 8,
    padding: 4,
    borderWidth: 1,
    borderColor: '#60a5fa',
  },
  markerDest: {
    alignItems: 'center',
    backgroundColor: 'rgba(201,168,76,0.9)',
    borderRadius: 8,
    padding: 4,
    borderWidth: 1,
    borderColor: '#C9A84C',
  },
  markerEmoji: {
    fontSize: 18,
  },
  markerLabel: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    maxWidth: 80,
    textAlign: 'center',
  },
  markerLabelDest: {
    color: '#0a0f1a',
    fontSize: 10,
    fontWeight: '700',
    maxWidth: 80,
    textAlign: 'center',
  },
  poiMarker: {
    backgroundColor: 'rgba(10,15,26,0.8)',
    borderRadius: 14,
    padding: 2,
  },
  poiMarkerEmoji: {
    fontSize: 16,
  },

  // ── POI strip ──
  poiStrip: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 96,
    justifyContent: 'center',
    backgroundColor: 'rgba(10,15,26,0.75)',
  },
  poiScroll: {
    paddingHorizontal: 12,
    gap: 8,
  },
  poiCard: {
    width: 60,
    height: 80,
    backgroundColor: '#111827',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1e2d40',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
    marginRight: 8,
  },
  poiCardEmoji: {
    fontSize: 20,
  },
  poiCardName: {
    color: '#f1f5f9',
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 2,
  },
  poiCardDist: {
    color: '#C9A84C',
    fontSize: 9,
    marginTop: 2,
  },

  // ── Bottom sheet ──
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
  },
  handleArea: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#334155',
    borderRadius: 2,
    marginBottom: 4,
  },
  chevron: {
    color: '#64748b',
    fontSize: 10,
  },
  sheetScroll: {
    flex: 1,
  },
  sheetCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Expanded content ──
  expandedContent: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  routeCol: {
    flex: 1,
  },
  routeArrow: {
    color: '#C9A84C',
    fontSize: 20,
    fontWeight: '700',
  },
  routeLabel: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  routeCity: {
    color: '#f1f5f9',
    fontSize: 14,
    fontWeight: '700',
  },
  routeMeta: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 8,
  },
  detailLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
    width: 80,
    letterSpacing: 0.5,
  },
  detailValue: {
    flex: 1,
    color: '#f1f5f9',
    fontSize: 13,
  },
  payBanner: {
    backgroundColor: '#052e16',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#16a34a',
    padding: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  payLabel: {
    color: '#4ade80',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  payAmount: {
    color: '#4ade80',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 1,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  actionBtn: {
    flex: 1,
    minWidth: '45%',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionBtnBlue: { backgroundColor: '#1d4ed8' },
  actionBtnGreen: { backgroundColor: '#15803d' },
  actionBtnGold: { backgroundColor: '#92400e' },
  actionBtnRed: { backgroundColor: '#7f1d1d' },
  actionBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },

  // ── Collapsed content ──
  collapsedContent: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  collapsedRow1: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  collapsedTracking: {
    color: '#f1f5f9',
    fontWeight: '700',
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 1,
  },
  collapsedRoute: {
    color: '#94a3b8',
    fontSize: 12,
    flex: 1,
  },
  collapsedRow2: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  collapsedPay: {
    color: '#4ade80',
    fontWeight: '800',
    fontSize: 15,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 8,
  },
  quickBtn: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  quickBtnText: {
    color: '#f1f5f9',
    fontSize: 12,
    fontWeight: '600',
  },

  // ── No load ──
  noLoadContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  noLoadText: {
    color: '#64748b',
    fontSize: 16,
    marginBottom: 12,
  },
  browseBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  browseBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});
