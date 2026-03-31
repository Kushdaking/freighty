import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/colors';
import type { CarrierUser } from '@/lib/types';

export default function ProfileScreen() {
  const [carrier, setCarrier] = useState<CarrierUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('carrier_users')
        .select('*')
        .eq('auth_user_id', user.id)
        .single();

      setCarrier(data);
      setLoading(false);
    }
    load();
  }, []);

  async function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {carrier?.name?.charAt(0).toUpperCase() ?? '?'}
        </Text>
      </View>

      <Text style={styles.name}>{carrier?.name ?? 'Unknown Carrier'}</Text>
      <Text style={styles.email}>{carrier?.email}</Text>

      {carrier?.is_verified && (
        <View style={styles.verifiedBadge}>
          <Text style={styles.verifiedText}>✅ Verified Carrier</Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Company</Text>
        <InfoRow label="Company" value={carrier?.company_name} />
        <InfoRow label="Phone" value={carrier?.phone} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Credentials</Text>
        <InfoRow label="MC Number" value={carrier?.mc_number} />
        <InfoRow label="DOT Number" value={carrier?.dot_number} />
        <InfoRow label="FMCSA Status" value={carrier?.fmcsa_status?.toUpperCase()} />
      </View>

      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
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
  content: { padding: 24, alignItems: 'center', gap: 12 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 4,
  },
  avatarText: { color: colors.white, fontSize: 36, fontWeight: '800' },
  name: { color: colors.text, fontSize: 22, fontWeight: '800' },
  email: { color: colors.textMuted, fontSize: 14 },
  verifiedBadge: {
    backgroundColor: colors.success + '22',
    borderWidth: 1,
    borderColor: colors.success,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  verifiedText: { color: colors.success, fontWeight: '600', fontSize: 13 },
  section: {
    width: '100%',
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
  },
  sectionTitle: { color: colors.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between' },
  infoLabel: { color: colors.textMuted, fontSize: 14 },
  infoValue: { color: colors.text, fontSize: 14, fontWeight: '600' },
  signOutBtn: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  signOutText: { color: colors.danger, fontWeight: '700', fontSize: 15 },
});
