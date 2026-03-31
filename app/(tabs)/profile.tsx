import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, ScrollView, TextInput,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/colors';
import type { CarrierUser } from '@/lib/types';

const DEADHEAD_STEPS = [25, 50, 75, 100];

export default function ProfileScreen() {
  const [carrier, setCarrier] = useState<CarrierUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Route preference state
  const [homeBaseCity, setHomeBaseCity] = useState('');
  const [homeBaseState, setHomeBaseState] = useState('');
  const [maxDeadhead, setMaxDeadhead] = useState(50);
  const [nextDestCity, setNextDestCity] = useState('');
  const [nextDestState, setNextDestState] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('carrier_users')
      .select('*')
      .eq('auth_user_id', user.id)
      .single();

    if (data) {
      setCarrier(data);
      setHomeBaseCity(data.home_base_city ?? '');
      setHomeBaseState(data.home_base_state ?? '');
      setMaxDeadhead(data.max_deadhead_miles ?? 50);
      setNextDestCity(data.next_available_location_city ?? '');
      setNextDestState(data.next_available_location_state ?? '');
    }
    setLoading(false);
  }

  async function handleSaveRoutePrefs() {
    if (!carrier) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('carrier_users')
        .update({
          home_base_city: homeBaseCity || null,
          home_base_state: homeBaseState?.toUpperCase().slice(0, 2) || null,
          max_deadhead_miles: maxDeadhead,
          next_available_location_city: nextDestCity || null,
          next_available_location_state: nextDestState?.toUpperCase().slice(0, 2) || null,
        })
        .eq('id', carrier.id);

      if (error) throw error;
      Alert.alert('Saved', 'Route preferences updated.');
      load();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

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

      {/* ── Route Preferences ──────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🗺️ Route Preferences</Text>

        <Text style={styles.fieldLabel}>Home Base</Text>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, { flex: 2, marginRight: 8 }]}
            placeholder="City"
            placeholderTextColor={colors.textMuted}
            value={homeBaseCity}
            onChangeText={setHomeBaseCity}
            autoCapitalize="words"
          />
          <TextInput
            style={[styles.input, { flex: 1, textTransform: 'uppercase' }]}
            placeholder="ST"
            placeholderTextColor={colors.textMuted}
            value={homeBaseState}
            onChangeText={t => setHomeBaseState(t.toUpperCase().slice(0, 2))}
            maxLength={2}
            autoCapitalize="characters"
          />
        </View>

        <Text style={styles.fieldLabel}>
          Max Deadhead Miles: <Text style={styles.sliderValue}>{maxDeadhead} mi</Text>
        </Text>
        <Slider
          style={styles.slider}
          minimumValue={25}
          maximumValue={100}
          step={25}
          value={maxDeadhead}
          onValueChange={setMaxDeadhead}
          minimumTrackTintColor={colors.primary}
          maximumTrackTintColor={colors.border}
          thumbTintColor={colors.primary}
        />
        <View style={styles.sliderTicks}>
          {DEADHEAD_STEPS.map(v => (
            <Text key={v} style={[styles.sliderTick, maxDeadhead === v && styles.sliderTickActive]}>
              {v}
            </Text>
          ))}
        </View>

        <Text style={styles.fieldLabel}>Where are you heading next?</Text>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, { flex: 2, marginRight: 8 }]}
            placeholder="Destination city"
            placeholderTextColor={colors.textMuted}
            value={nextDestCity}
            onChangeText={setNextDestCity}
            autoCapitalize="words"
          />
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="ST"
            placeholderTextColor={colors.textMuted}
            value={nextDestState}
            onChangeText={t => setNextDestState(t.toUpperCase().slice(0, 2))}
            maxLength={2}
            autoCapitalize="characters"
          />
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSaveRoutePrefs}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator size="small" color={colors.white} />
            : <Text style={styles.saveBtnText}>Save Route Preferences</Text>
          }
        </TouchableOpacity>
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
  fieldLabel: { color: colors.text, fontSize: 13, fontWeight: '600', marginBottom: -4 },
  row: { flexDirection: 'row', alignItems: 'center' },
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
  slider: { width: '100%', height: 40 },
  sliderValue: { color: colors.primary, fontWeight: '800' },
  sliderTicks: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -8, paddingHorizontal: 2 },
  sliderTick: { color: colors.textMuted, fontSize: 11 },
  sliderTickActive: { color: colors.primary, fontWeight: '700' },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: colors.white, fontWeight: '700', fontSize: 15 },
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
