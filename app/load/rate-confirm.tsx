/**
 * Rate Confirmation Screen
 * Carrier reviews load details and confirms/declines the rate before accepting.
 * Usage: router.push(`/load/rate-confirm?id=${shipmentId}`)
 */

import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/colors';
import type { Shipment, Vehicle } from '@/lib/types';

export default function RateConfirmScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [load, setLoad] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [declining, setDeclining] = useState(false);

  useEffect(() => {
    async function fetchLoad() {
      const { data, error } = await supabase
        .from('shipments')
        .select('*, vehicles(*)')
        .eq('id', id)
        .single();

      if (!error && data) setLoad(data);
      setLoading(false);
    }
    fetchLoad();
  }, [id]);

  async function handleConfirm() {
    if (!load) return;
    setConfirming(true);

    try {
      const { error } = await supabase
        .from('shipments')
        .update({
          carrier_status: 'accepted',
          updated_at: new Date().toISOString(),
        })
        .eq('id', load.id);

      if (error) throw error;

      // Log event
      await supabase.from('shipment_events').insert({
        shipment_id: load.id,
        event_type: 'carrier_rate_confirmed',
        description: `Carrier confirmed rate of $${parseFloat(String(load.total_price || 0)).toFixed(2)}`,
        event_time: new Date().toISOString(),
      });

      Alert.alert(
        '✅ Load Accepted',
        `You have accepted this load for $${parseFloat(String(load.total_price || 0)).toFixed(2)}. Head to pickup when ready.`,
        [
          {
            text: 'View Load',
            onPress: () => router.replace(`/load/${load.id}`),
          },
        ]
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not confirm rate');
    } finally {
      setConfirming(false);
    }
  }

  async function handleDecline() {
    if (!load) return;

    Alert.alert(
      'Decline Load',
      'Are you sure you want to decline this load?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            setDeclining(true);
            try {
              const { error } = await supabase
                .from('shipments')
                .update({
                  carrier_status: 'rejected',
                  carrier_user_id: null,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', load.id);

              if (error) throw error;

              await supabase.from('shipment_events').insert({
                shipment_id: load.id,
                event_type: 'carrier_declined',
                description: 'Carrier declined the load',
                event_time: new Date().toISOString(),
              });

              router.replace('/(tabs)');
            } catch (err: any) {
              Alert.alert('Error', err.message);
            } finally {
              setDeclining(false);
            }
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!load) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Load not found</Text>
      </View>
    );
  }

  const vehicles: Vehicle[] = (load as any).vehicles ?? [];
  const rate = parseFloat(String(load.total_price || 0));
  const vehicleCount = vehicles.length;
  const ratePerVehicle = vehicleCount > 0 ? (rate / vehicleCount).toFixed(2) : '—';

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 120 }}>
      <Stack.Screen options={{ title: 'Confirm Rate', headerBackTitle: 'Back' }} />

      {/* Rate Hero */}
      <View style={styles.rateHero}>
        <Text style={styles.rateLabel}>Load Rate</Text>
        <Text style={styles.rateAmount}>${rate.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
        {vehicleCount > 1 && (
          <Text style={styles.ratePerVehicle}>${ratePerVehicle} per vehicle</Text>
        )}
        <View style={styles.transportBadge}>
          <Text style={styles.transportText}>{load.transport_type || 'Open'} Transport</Text>
        </View>
        {load.is_expedited && (
          <View style={[styles.transportBadge, { backgroundColor: colors.accent + '33', borderColor: colors.accent + '66' }]}>
            <Text style={[styles.transportText, { color: colors.accent }]}>⚡ Expedited</Text>
          </View>
        )}
      </View>

      {/* Route */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Route</Text>
        <View style={styles.routeCard}>
          <View style={styles.routeRow}>
            <Text style={styles.routeIcon}>📍</Text>
            <View style={styles.routeInfo}>
              <Text style={styles.routeLabel}>Pickup</Text>
              <Text style={styles.routeCity}>{load.origin_city}, {load.origin_state}</Text>
              <Text style={styles.routeAddr}>{load.origin_address}</Text>
              {load.origin_contact_name && (
                <Text style={styles.routeContact}>Contact: {load.origin_contact_name}</Text>
              )}
              {load.scheduled_pickup && (
                <Text style={styles.routeDate}>
                  📅 {new Date(load.scheduled_pickup).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </Text>
              )}
            </View>
          </View>

          <View style={styles.routeDivider}>
            <View style={styles.routeLine} />
          </View>

          <View style={styles.routeRow}>
            <Text style={styles.routeIcon}>🏁</Text>
            <View style={styles.routeInfo}>
              <Text style={styles.routeLabel}>Delivery</Text>
              <Text style={styles.routeCity}>{load.destination_city}, {load.destination_state}</Text>
              <Text style={styles.routeAddr}>{load.destination_address}</Text>
              {load.destination_contact_name && (
                <Text style={styles.routeContact}>Contact: {load.destination_contact_name}</Text>
              )}
              {load.estimated_delivery && (
                <Text style={styles.routeDate}>
                  📅 Est. {new Date(load.estimated_delivery).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </Text>
              )}
            </View>
          </View>
        </View>

        {load.distance_miles && (
          <Text style={styles.distanceText}>~{load.distance_miles.toLocaleString()} miles</Text>
        )}
      </View>

      {/* Vehicles */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Vehicles ({vehicleCount})</Text>
        {vehicles.map((v, idx) => (
          <View key={v.id} style={styles.vehicleRow}>
            <View style={styles.vehicleNum}>
              <Text style={styles.vehicleNumText}>{idx + 1}</Text>
            </View>
            <View style={styles.vehicleInfo}>
              <Text style={styles.vehicleName}>
                {[v.year, v.make, v.model].filter(Boolean).join(' ') || 'Unknown Vehicle'}
              </Text>
              <Text style={styles.vehicleVin}>{v.vin}</Text>
            </View>
            <View style={[
              styles.opBadge,
              { backgroundColor: v.is_operable ? colors.success + '22' : colors.warning + '22' }
            ]}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: v.is_operable ? colors.success : colors.warning }}>
                {v.is_operable ? 'Operable' : 'Inop'}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Notes */}
      {load.notes && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dispatcher Notes</Text>
          <View style={styles.notesBox}>
            <Text style={styles.notesText}>{load.notes}</Text>
          </View>
        </View>
      )}

      {/* Terms reminder */}
      <View style={styles.termsBox}>
        <Text style={styles.termsText}>
          By accepting, you agree to transport all listed vehicles in accordance with Prevayl's carrier agreement. Rate is final — no adjustments after acceptance.
        </Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionBar}>
        <TouchableOpacity
          style={styles.declineBtn}
          onPress={handleDecline}
          disabled={declining || confirming}
        >
          <Text style={styles.declineText}>
            {declining ? 'Declining...' : 'Decline'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.acceptBtn, (confirming || declining) && styles.disabledBtn]}
          onPress={handleConfirm}
          disabled={confirming || declining}
        >
          <Text style={styles.acceptText}>
            {confirming ? 'Confirming...' : `✓ Accept $${rate.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: colors.textDim, fontSize: 14 },
  rateHero: {
    backgroundColor: colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    padding: 28,
    alignItems: 'center',
    gap: 6,
  },
  rateLabel: { fontSize: 12, fontWeight: '700', color: colors.textDim, textTransform: 'uppercase', letterSpacing: 0.5 },
  rateAmount: { fontSize: 40, fontWeight: '900', color: colors.success, letterSpacing: -1 },
  ratePerVehicle: { fontSize: 13, color: colors.textMuted },
  transportBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: colors.primary + '22',
    borderWidth: 1,
    borderColor: colors.primary + '55',
    marginTop: 4,
  },
  transportText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  section: { padding: 16 },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: colors.textDim, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  routeCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  routeRow: { flexDirection: 'row', gap: 10 },
  routeIcon: { fontSize: 20, marginTop: 2 },
  routeInfo: { flex: 1 },
  routeLabel: { fontSize: 10, fontWeight: '700', color: colors.textDim, textTransform: 'uppercase', letterSpacing: 0.4 },
  routeCity: { fontSize: 15, fontWeight: '800', color: colors.text, marginTop: 2 },
  routeAddr: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  routeContact: { fontSize: 11, color: colors.textDim, marginTop: 4 },
  routeDate: { fontSize: 12, color: colors.primary, marginTop: 4, fontWeight: '600' },
  routeDivider: { paddingLeft: 28, marginVertical: 10 },
  routeLine: { height: 24, width: 2, backgroundColor: colors.border, marginLeft: 8 },
  distanceText: { fontSize: 12, color: colors.textDim, textAlign: 'center', marginTop: 8 },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 6,
    gap: 10,
  },
  vehicleNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.bgCardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleNumText: { fontSize: 12, fontWeight: '800', color: colors.textDim },
  vehicleInfo: { flex: 1 },
  vehicleName: { fontSize: 13, fontWeight: '700', color: colors.text },
  vehicleVin: { fontSize: 11, color: colors.textDim, fontFamily: 'monospace', marginTop: 2 },
  opBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  notesBox: {
    backgroundColor: colors.bgCard,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  notesText: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  termsBox: {
    margin: 16,
    marginTop: 0,
    padding: 12,
    backgroundColor: colors.bgCardAlt,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  termsText: { fontSize: 11, color: colors.textDim, lineHeight: 16, textAlign: 'center' },
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    paddingBottom: 32,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  declineBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.danger + '55',
    backgroundColor: colors.danger + '11',
    alignItems: 'center',
  },
  declineText: { color: colors.danger, fontSize: 14, fontWeight: '700' },
  acceptBtn: {
    flex: 2,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.success,
    alignItems: 'center',
    shadowColor: colors.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  acceptText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  disabledBtn: { opacity: 0.6 },
});
