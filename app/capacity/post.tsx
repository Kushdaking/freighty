import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, Switch,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/colors';

const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];
const EQUIPMENT_TYPES = ['open', 'enclosed', 'flatbed', 'driveaway', 'hotshot'];

export default function PostCapacityScreen() {
  const [carrierId, setCarrierId] = useState<string | null>(null);
  const [postings, setPostings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [originCity, setOriginCity] = useState('');
  const [originState, setOriginState] = useState('CA');
  const [destCity, setDestCity] = useState('');
  const [destState, setDestState] = useState('TX');
  const [availableDate, setAvailableDate] = useState('');
  const [equipmentType, setEquipmentType] = useState('open');
  const [maxVehicles, setMaxVehicles] = useState('8');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: carrier } = await supabase
      .from('carrier_users')
      .select('id')
      .eq('auth_user_id', user.id)
      .single();
    if (carrier) {
      setCarrierId(carrier.id);
      const { data: caps } = await supabase
        .from('carrier_capacity')
        .select('*')
        .eq('carrier_user_id', carrier.id)
        .eq('is_active', true)
        .order('available_date', { ascending: true });
      setPostings(caps ?? []);
    }
    setLoading(false);
  }

  async function submitPosting() {
    if (!carrierId) return;
    if (!originState || !destState || !availableDate) {
      Alert.alert('Missing Info', 'Please fill in all required fields.');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('carrier_capacity').insert({
        carrier_user_id: carrierId,
        origin_city: originCity || null,
        origin_state: originState,
        destination_city: destCity || null,
        destination_state: destState,
        available_date: availableDate,
        equipment_type: equipmentType,
        max_vehicles: parseInt(maxVehicles) || 8,
        notes: notes || null,
        is_active: true,
        expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      });
      if (error) throw error;
      Alert.alert('Posted!', 'Your capacity has been posted to dispatchers.');
      setOriginCity('');
      setDestCity('');
      setAvailableDate('');
      setNotes('');
      loadData();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function deactivate(id: string) {
    await supabase.from('carrier_capacity').update({ is_active: false }).eq('id', id);
    setPostings(p => p.filter(c => c.id !== id));
  }

  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Post My Capacity</Text>
      <Text style={styles.subtitle}>Let dispatchers know where you're available to haul loads.</Text>

      {/* Form */}
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>ROUTE</Text>
        <View style={styles.row}>
          <View style={styles.flex2}>
            <Text style={styles.fieldLabel}>Origin City</Text>
            <TextInput style={styles.input} value={originCity} onChangeText={setOriginCity} placeholder="Los Angeles" placeholderTextColor={colors.textMuted} />
          </View>
          <View style={styles.flex1}>
            <Text style={styles.fieldLabel}>State *</Text>
            <View style={styles.stateInput}>
              <TextInput style={[styles.input, { textAlign: 'center', fontWeight: '700' }]} value={originState} onChangeText={t => setOriginState(t.toUpperCase().slice(0, 2))} placeholder="CA" placeholderTextColor={colors.textMuted} maxLength={2} autoCapitalize="characters" />
            </View>
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.flex2}>
            <Text style={styles.fieldLabel}>Destination City</Text>
            <TextInput style={styles.input} value={destCity} onChangeText={setDestCity} placeholder="Dallas" placeholderTextColor={colors.textMuted} />
          </View>
          <View style={styles.flex1}>
            <Text style={styles.fieldLabel}>State *</Text>
            <TextInput style={[styles.input, { textAlign: 'center', fontWeight: '700' }]} value={destState} onChangeText={t => setDestState(t.toUpperCase().slice(0, 2))} placeholder="TX" placeholderTextColor={colors.textMuted} maxLength={2} autoCapitalize="characters" />
          </View>
        </View>

        <Text style={styles.sectionLabel}>DETAILS</Text>
        <View style={styles.row}>
          <View style={styles.flex1}>
            <Text style={styles.fieldLabel}>Available Date *</Text>
            <TextInput style={styles.input} value={availableDate} onChangeText={setAvailableDate} placeholder={tomorrow} placeholderTextColor={colors.textMuted} />
          </View>
          <View style={styles.flex1}>
            <Text style={styles.fieldLabel}>Max Vehicles</Text>
            <TextInput style={[styles.input, { textAlign: 'center' }]} value={maxVehicles} onChangeText={setMaxVehicles} keyboardType="numeric" placeholder="8" placeholderTextColor={colors.textMuted} />
          </View>
        </View>

        <Text style={styles.fieldLabel}>Equipment Type</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {EQUIPMENT_TYPES.map(t => (
              <TouchableOpacity key={t} onPress={() => setEquipmentType(t)}
                style={[styles.chip, equipmentType === t && styles.chipActive]}>
                <Text style={[styles.chipText, equipmentType === t && styles.chipTextActive]}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <Text style={styles.fieldLabel}>Notes (optional)</Text>
        <TextInput style={[styles.input, { height: 72 }]} value={notes} onChangeText={setNotes} placeholder="Any notes for dispatchers..." placeholderTextColor={colors.textMuted} multiline />

        <TouchableOpacity style={[styles.btn, submitting && { opacity: 0.6 }]} onPress={submitPosting} disabled={submitting}>
          {submitting ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.btnText}>🚛 Post Capacity</Text>}
        </TouchableOpacity>
      </View>

      {/* Active postings */}
      {postings.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>MY ACTIVE POSTINGS</Text>
          {postings.map(p => (
            <View key={p.id} style={styles.posting}>
              <View style={{ flex: 1 }}>
                <Text style={styles.postingRoute}>{p.origin_state} → {p.destination_state}</Text>
                <Text style={styles.postingDetails}>{new Date(p.available_date).toLocaleDateString()} · {p.max_vehicles} vehicles · {p.equipment_type}</Text>
              </View>
              <TouchableOpacity onPress={() => Alert.alert('Deactivate?', 'Remove this posting?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Remove', style: 'destructive', onPress: () => deactivate(p.id) },
              ])} style={styles.deactivateBtn}>
                <Text style={styles.deactivateBtnText}>Remove</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 4 },
  subtitle: { fontSize: 14, color: colors.textMuted, marginBottom: 8 },
  card: { backgroundColor: colors.bgCard, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border, gap: 12 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 1, marginTop: 4 },
  fieldLabel: { fontSize: 12, color: colors.textMuted, marginBottom: 4 },
  row: { flexDirection: 'row', gap: 10 },
  flex1: { flex: 1 },
  flex2: { flex: 2 },
  stateInput: { },
  input: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, color: colors.text, fontSize: 14 },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, color: colors.textMuted },
  chipTextActive: { color: '#2E4057', fontWeight: '700' },
  btn: { backgroundColor: colors.primary, borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 4 },
  btnText: { color: '#2E4057', fontWeight: '800', fontSize: 15 },
  posting: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border },
  postingRoute: { fontSize: 15, fontWeight: '700', color: colors.text },
  postingDetails: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  deactivateBtn: { borderWidth: 1, borderColor: colors.danger, borderRadius: 6, padding: 6 },
  deactivateBtnText: { color: colors.danger, fontSize: 12, fontWeight: '600' },
});
