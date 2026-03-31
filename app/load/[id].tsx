import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, Linking,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { colors, statusColors } from '@/lib/colors';
import { TrackingBanner } from '@/components/TrackingBanner';
import { startTracking, stopTracking } from '@/lib/gps';
import type { Shipment, ShipmentEvent } from '@/lib/types';

export default function LoadDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [load, setLoad] = useState<Shipment | null>(null);
  const [events, setEvents] = useState<ShipmentEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [loadOrder, setLoadOrder] = useState<any[]>([]);

  useEffect(() => {
    async function fetch() {
      const [shipmentRes, eventsRes] = await Promise.all([
        supabase.from('shipments').select('*, vehicles(*)').eq('id', id).single(),
        supabase.from('shipment_events').select('*').eq('shipment_id', id).order('event_time', { ascending: false }),
      ]);
      if (shipmentRes.data) {
        setLoad(shipmentRes.data);
        // Compute load order if multi-vehicle (inline optimization)
        if (shipmentRes.data.vehicles && shipmentRes.data.vehicles.length > 1) {
          try {
            const vehicles = shipmentRes.data.vehicles;
            const GVWR_DEFAULTS: Record<string, number> = {
              'Truck': 8500, 'Pickup': 7500, 'SUV': 6500, 'Van': 5000,
              'Sedan': 4000, 'Coupe': 3800, 'Convertible': 3600,
            };
            const enriched = vehicles.map((v: any, idx: number) => {
              let gvwr = 4000;
              for (const [type, weight] of Object.entries(GVWR_DEFAULTS)) {
                if (v.model?.toLowerCase().includes(type.toLowerCase())) { gvwr = weight; break; }
              }
              return { ...v, estimatedGVWR: gvwr, isInoperable: !v.is_operable, isOversized: gvwr > 7000, originalIndex: idx };
            });
            const sorted = [...enriched].sort((a: any, b: any) => {
              if (a.isInoperable !== b.isInoperable) return a.isInoperable ? 1 : -1;
              return b.estimatedGVWR - a.estimatedGVWR;
            });
            setLoadOrder(sorted.map((v: any, idx: number) => ({
              position: idx + 1,
              vehicleId: v.id,
              vin: v.vin,
              year: v.year,
              make: v.make,
              model: v.model,
              isInoperable: v.isInoperable,
              isOversized: v.isOversized,
              deckRecommendation: idx < Math.ceil(sorted.length / 2) ? 'lower' : 'upper',
              loadingNote: v.isInoperable ? 'INOP — needs winch or dolly' : v.isOversized ? 'OVERSIZED — verify clearance' : 'Standard loading',
            })));
          } catch { /* non-critical */ }
        }
      }
      if (eventsRes.data) setEvents(eventsRes.data);
      setLoading(false);
    }
    fetch();
  }, [id]);

  async function updateStatus(newStatus: string) {
    setUpdating(true);
    const { error } = await supabase
      .from('shipments')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (!error) {
      // Log the event
      await supabase.from('shipment_events').insert({
        shipment_id: id,
        event_type: newStatus,
        description: `Status updated to ${newStatus.replace(/_/g, ' ')}`,
        event_time: new Date().toISOString(),
      });

      // Auto-start GPS when picked up, auto-stop when delivered
      if (newStatus === 'picked_up') startTracking(id);
      if (newStatus === 'delivered') stopTracking();

      setLoad((prev) => prev ? { ...prev, status: newStatus as any } : prev);
    } else {
      Alert.alert('Error', error.message);
    }
    setUpdating(false);
  }

  function getNextAction(): { label: string; status: string; color: string } | null {
    switch (load?.status) {
      case 'pending': return { label: '📦 Mark as Picked Up', status: 'picked_up', color: colors.primary };
      case 'picked_up': return { label: '🚛 Mark In Transit', status: 'in_transit', color: colors.primary };
      case 'in_transit': return { label: '🏁 Out for Delivery', status: 'out_for_delivery', color: colors.primary };
      case 'out_for_delivery': return { label: '✅ Mark Delivered', status: 'delivered', color: colors.success };
      default: return null;
    }
  }

  if (loading || !load) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const statusColor = statusColors[load.status] ?? colors.textMuted;
  const nextAction = getNextAction();
  const vehicleCount = load.vehicles?.length ?? 0;

  return (
    <>
      <Stack.Screen options={{ title: load.tracking_number }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>

        {/* Status Badge */}
        <View style={[styles.statusBanner, { backgroundColor: statusColor + '22', borderColor: statusColor }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>
            {load.status.replace(/_/g, ' ').toUpperCase()}
          </Text>
        </View>

        {/* GPS Tracking Banner */}
        <TrackingBanner shipmentId={id} shipmentStatus={load.status} />

        {/* Next Action */}
        {nextAction && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: nextAction.color }, updating && styles.btnDisabled]}
            onPress={() => {
              Alert.alert('Update Status', nextAction.label + '?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Confirm', onPress: () => updateStatus(nextAction.status) },
              ]);
            }}
            disabled={updating}
          >
            {updating
              ? <ActivityIndicator color={colors.white} />
              : <Text style={styles.actionBtnText}>{nextAction.label}</Text>
            }
          </TouchableOpacity>
        )}

        {/* Route */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Route</Text>
          <RouteStop
            label="PICKUP"
            address={load.origin_address}
            city={`${load.origin_city}, ${load.origin_state} ${load.origin_zip ?? ''}`}
            contact={load.origin_contact_name}
            phone={load.origin_contact_phone}
          />
          <View style={styles.divider} />
          <RouteStop
            label="DELIVERY"
            address={load.destination_address}
            city={`${load.destination_city}, ${load.destination_state} ${load.destination_zip ?? ''}`}
            contact={load.destination_contact_name}
            phone={load.destination_contact_phone}
          />
          {load.distance_miles && (
            <Text style={styles.distance}>📍 {Math.round(load.distance_miles)} miles</Text>
          )}
        </View>

        {/* Vehicles */}
        {load.vehicles && load.vehicles.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Vehicles ({vehicleCount})</Text>
            {load.vehicles.map((v) => (
              <View key={v.id} style={styles.vehicleRow}>
                <Text style={styles.vehicleName}>
                  {[v.year, v.make, v.model].filter(Boolean).join(' ') || 'Unknown Vehicle'}
                </Text>
                <Text style={styles.vehicleSub}>VIN: {v.vin}</Text>
                <Text style={styles.vehicleSub}>
                  Condition: {v.condition} · {v.is_operable ? '✅ Operable' : '⚠️ Inoperable'}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Load Order (multi-vehicle only) */}
        {loadOrder.length > 1 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>🚛 Recommended Load Order</Text>
            {loadOrder.map((item: any) => (
              <View key={item.vehicleId} style={styles.loadOrderRow}>
                <View style={[styles.loadOrderNum, { backgroundColor: item.isInoperable ? '#f59e0b22' : colors.primary + '22' }]}>
                  <Text style={[styles.loadOrderNumText, { color: item.isInoperable ? '#f59e0b' : colors.primary }]}>
                    {item.position}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.vehicleName}>
                    {[item.year, item.make, item.model].filter(Boolean).join(' ') || `Vehicle ${item.position}`}
                  </Text>
                  <Text style={styles.vehicleSub}>
                    {item.deckRecommendation === 'lower' ? '⬇️ Lower deck' : '⬆️ Upper deck'}
                    {item.isInoperable ? ' · ⚠️ INOP' : ''}
                    {item.isOversized ? ' · 📏 Oversized' : ''}
                  </Text>
                  <Text style={[styles.vehicleSub, { fontSize: 11 }]}>{item.loadingNote}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Load Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Load Details</Text>
          <InfoRow label="Transport Type" value={load.transport_type.toUpperCase()} />
          <InfoRow label="Expedited" value={load.is_expedited ? 'Yes' : 'No'} />
          <InfoRow label="Cross-Border" value={load.is_cross_border ? 'Yes' : 'No'} />
          {load.carrier_rate && <InfoRow label="Your Rate" value={`$${load.carrier_rate.toLocaleString()}`} />}
          {load.scheduled_pickup && (
            <InfoRow label="Scheduled Pickup" value={new Date(load.scheduled_pickup).toLocaleString()} />
          )}
          {load.estimated_delivery && (
            <InfoRow label="Est. Delivery" value={new Date(load.estimated_delivery).toLocaleString()} />
          )}
          {load.notes && <InfoRow label="Notes" value={load.notes} />}
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <QuickAction icon="📋" label="Pickup\neBOL" onPress={() => router.push({ pathname: '/load/bol', params: { id, stage: 'pickup' } })} />
          <QuickAction icon="✅" label="Delivery\neBOL" onPress={() => router.push({ pathname: '/load/bol', params: { id, stage: 'delivery' } })} />
          <QuickAction icon="🔍" label="Condition\nReport" onPress={() => router.push({ pathname: '/load/condition', params: { id, stage: 'pickup' } })} />
          <QuickAction icon="⚠️" label="Exception" onPress={() => router.push({ pathname: '/load/exception', params: { id } })} />
        </View>

        {/* Load Instructions */}
        <TouchableOpacity
          style={styles.instructionsBtn}
          onPress={() => router.push({ pathname: '/load/instructions', params: { id } })}
        >
          <Text style={styles.instructionsBtnText}>📋 Load Instructions — Loading Guide</Text>
        </TouchableOpacity>
        <View style={styles.quickActions}>
          <QuickAction icon="💬" label="Messages" onPress={() => router.push({ pathname: '/load/messages', params: { id } })} />
          <QuickAction icon="📄" label="Documents" onPress={() => router.push({ pathname: '/load/documents', params: { id } })} />
          <QuickAction icon="📷" label="Photos" onPress={() => router.push({ pathname: '/load/photos', params: { id } })} />
        </View>

        {/* Timeline */}
        {events.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Timeline</Text>
            {events.map((e) => (
              <View key={e.id} style={styles.eventRow}>
                <Text style={styles.eventTime}>
                  {new Date(e.event_time).toLocaleString()}
                </Text>
                <Text style={styles.eventDesc}>{e.description}</Text>
              </View>
            ))}
          </View>
        )}

      </ScrollView>
    </>
  );
}

function RouteStop({ label, address, city, contact, phone }: any) {
  return (
    <View style={styles.routeStop}>
      <Text style={styles.stopLabel}>{label}</Text>
      <Text style={styles.stopCity}>{city}</Text>
      <Text style={styles.stopAddress}>{address}</Text>
      {contact && <Text style={styles.stopContact}>👤 {contact}</Text>}
      {phone && (
        <TouchableOpacity onPress={() => Linking.openURL(`tel:${phone}`)}>
          <Text style={styles.stopPhone}>📞 {phone}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function QuickAction({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.quickAction} onPress={onPress}>
      <Text style={styles.quickIcon}>{icon}</Text>
      <Text style={styles.quickLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value ?? '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 12 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  statusBanner: {
    borderWidth: 1, borderRadius: 10, padding: 12, alignItems: 'center',
  },
  statusText: { fontWeight: '800', fontSize: 15, letterSpacing: 1 },
  actionBtn: {
    borderRadius: 12, padding: 16, alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  actionBtnText: { color: colors.white, fontWeight: '800', fontSize: 16 },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  cardTitle: { color: colors.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  divider: { height: 1, backgroundColor: colors.border },
  routeStop: { gap: 3 },
  stopLabel: { color: colors.textDim, fontSize: 11, fontWeight: '600' },
  stopCity: { color: colors.text, fontSize: 16, fontWeight: '700' },
  stopAddress: { color: colors.textMuted, fontSize: 13 },
  stopContact: { color: colors.textMuted, fontSize: 13 },
  stopPhone: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  distance: { color: colors.textMuted, fontSize: 13 },
  vehicleRow: { gap: 2, paddingVertical: 4, borderTopWidth: 1, borderTopColor: colors.border },
  vehicleName: { color: colors.text, fontWeight: '700', fontSize: 14 },
  vehicleSub: { color: colors.textMuted, fontSize: 13 },
  loadOrderRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.border,
  },
  loadOrderNum: {
    width: 28, height: 28, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  loadOrderNumText: { fontSize: 13, fontWeight: '800' },
  quickActions: { flexDirection: 'row', gap: 8 },
  quickAction: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    alignItems: 'center',
    gap: 4,
  },
  quickIcon: { fontSize: 24 },
  quickLabel: { color: colors.text, fontSize: 12, fontWeight: '600' },
  eventRow: { gap: 2 },
  eventTime: { color: colors.textDim, fontSize: 11 },
  eventDesc: { color: colors.text, fontSize: 13 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  infoLabel: { color: colors.textMuted, fontSize: 13, flex: 1 },
  infoValue: { color: colors.text, fontSize: 13, fontWeight: '600', flex: 1, textAlign: 'right' },
  instructionsBtn: {
    backgroundColor: '#1e3a5f',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3b82f6',
    padding: 14,
    alignItems: 'center',
  },
  instructionsBtnText: { color: '#60a5fa', fontWeight: '700', fontSize: 14 },
});
