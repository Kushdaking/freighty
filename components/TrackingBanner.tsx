import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { startTracking, stopTracking, isTracking } from '@/lib/gps';
import { colors } from '@/lib/colors';

interface TrackingBannerProps {
  shipmentId: string;
  shipmentStatus: string;
}

export function TrackingBanner({ shipmentId, shipmentStatus }: TrackingBannerProps) {
  const [tracking, setTracking] = useState(false);
  const [loading, setLoading] = useState(true);

  const canTrack = ['picked_up', 'in_transit', 'out_for_delivery'].includes(shipmentStatus);

  useEffect(() => {
    isTracking().then(active => {
      setTracking(active);
      setLoading(false);
    });
  }, []);

  async function toggleTracking() {
    if (tracking) {
      Alert.alert(
        'Stop Tracking',
        'Stop sharing your location with the dispatcher?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Stop',
            style: 'destructive',
            onPress: async () => {
              setLoading(true);
              await stopTracking();
              setTracking(false);
              setLoading(false);
            },
          },
        ]
      );
    } else {
      setLoading(true);
      const success = await startTracking(shipmentId);
      if (!success) {
        Alert.alert(
          'Location Permission Required',
          'Enable background location in Settings to share your location while driving.',
        );
      }
      setTracking(success);
      setLoading(false);
    }
  }

  if (!canTrack && !tracking) return null;

  return (
    <TouchableOpacity
      style={[styles.banner, tracking ? styles.bannerActive : styles.bannerInactive]}
      onPress={toggleTracking}
      disabled={loading}
      activeOpacity={0.8}
    >
      <View style={styles.left}>
        <View style={[styles.dot, tracking ? styles.dotActive : styles.dotInactive]} />
        <View>
          <Text style={[styles.title, tracking && styles.titleActive]}>
            {tracking ? 'Location Sharing Active' : 'Share Location'}
          </Text>
          <Text style={[styles.sub, tracking && styles.subActive]}>
            {tracking
              ? 'Dispatcher can see your real-time position'
              : 'Let dispatcher track your progress'
            }
          </Text>
        </View>
      </View>
      {loading
        ? <ActivityIndicator color={tracking ? colors.white : colors.primary} size="small" />
        : <Text style={[styles.action, tracking && styles.actionActive]}>
            {tracking ? 'Stop' : 'Start'}
          </Text>
      }
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 12, padding: 14, borderWidth: 1,
  },
  bannerActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
  },
  bannerInactive: {
    backgroundColor: colors.bgCard,
    borderColor: colors.border,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  dot: {
    width: 10, height: 10, borderRadius: 5,
  },
  dotActive: {
    backgroundColor: '#4ade80',
    shadowColor: '#4ade80',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  },
  dotInactive: { backgroundColor: colors.textDim },
  title: { color: colors.text, fontWeight: '700', fontSize: 14 },
  titleActive: { color: colors.white },
  sub: { color: colors.textMuted, fontSize: 12, marginTop: 1 },
  subActive: { color: 'rgba(255,255,255,0.75)' },
  action: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  actionActive: { color: colors.white, opacity: 0.9 },
});
