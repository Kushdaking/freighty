import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/colors';

const VEHICLE_TYPES = [
  'Open Transport', 'Enclosed Transport', 'Hotshot',
  'Flatbed', 'Driveaway', 'Multi-Car Carrier',
];

export default function CompanyStep() {
  const [company, setCompany] = useState('');
  const [country, setCountry] = useState<'US' | 'CA'>('US');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  function toggleType(type: string) {
    setSelectedTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  }

  async function handleNext() {
    if (!company.trim()) return Alert.alert('Required', 'Please enter your company name.');
    if (selectedTypes.length === 0) return Alert.alert('Required', 'Select at least one transport type.');

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      await supabase
        .from('carrier_users')
        .update({
          company_name: company.trim(),
          vehicle_types: selectedTypes,
        })
        .eq('auth_user_id', user.id);

      router.push('/onboarding/credentials');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.stepIndicator}>
        <StepDot num={1} done />
        <StepLine done />
        <StepDot num={2} active />
        <StepLine />
        <StepDot num={3} />
        <StepLine />
        <StepDot num={4} />
      </View>

      <Text style={styles.heading}>Your Company</Text>
      <Text style={styles.sub}>Tell us about your transport business</Text>

      <Text style={styles.label}>Company Name</Text>
      <TextInput
        style={styles.input}
        value={company}
        onChangeText={setCompany}
        placeholder="Smith Transport LLC"
        placeholderTextColor={colors.textDim}
      />

      <Text style={styles.label}>Country of Operation</Text>
      <View style={styles.countryRow}>
        <TouchableOpacity
          style={[styles.countryBtn, country === 'US' && styles.countryBtnActive]}
          onPress={() => setCountry('US')}
        >
          <Text style={[styles.countryText, country === 'US' && styles.countryTextActive]}>🇺🇸 United States</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.countryBtn, country === 'CA' && styles.countryBtnActive]}
          onPress={() => setCountry('CA')}
        >
          <Text style={[styles.countryText, country === 'CA' && styles.countryTextActive]}>🇨🇦 Canada</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>Transport Types</Text>
      <Text style={styles.hint}>Select all that apply</Text>
      <View style={styles.typeGrid}>
        {VEHICLE_TYPES.map(type => (
          <TouchableOpacity
            key={type}
            style={[styles.typeChip, selectedTypes.includes(type) && styles.typeChipActive]}
            onPress={() => toggleType(type)}
          >
            <Text style={[styles.typeText, selectedTypes.includes(type) && styles.typeTextActive]}>
              {type}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.btn, loading && styles.btnDisabled]}
        onPress={handleNext}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator color={colors.white} />
          : <Text style={styles.btnText}>Continue →</Text>
        }
      </TouchableOpacity>
    </ScrollView>
  );
}

function StepDot({ num, active, done }: { num: number; active?: boolean; done?: boolean }) {
  return (
    <View style={[styles.dot, active && styles.dotActive, done && styles.dotDone]}>
      <Text style={[styles.dotText, (active || done) && styles.dotTextActive]}>
        {done ? '✓' : num}
      </Text>
    </View>
  );
}
function StepLine({ done }: { done?: boolean }) {
  return <View style={[styles.stepLine, done && styles.stepLineDone]} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 24, gap: 10 },
  stepIndicator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  dot: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  dotActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  dotDone: { backgroundColor: colors.success, borderColor: colors.success },
  dotText: { color: colors.textMuted, fontWeight: '700', fontSize: 13 },
  dotTextActive: { color: colors.white },
  stepLine: { width: 32, height: 1, backgroundColor: colors.border },
  stepLineDone: { backgroundColor: colors.success },
  heading: { color: colors.text, fontSize: 26, fontWeight: '800' },
  sub: { color: colors.textMuted, fontSize: 15, marginBottom: 8 },
  label: { color: colors.textMuted, fontSize: 13, fontWeight: '600', marginTop: 8 },
  hint: { color: colors.textDim, fontSize: 12, marginBottom: 6 },
  input: {
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, padding: 14, color: colors.text, fontSize: 16,
  },
  countryRow: { flexDirection: 'row', gap: 10 },
  countryBtn: {
    flex: 1, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, padding: 14, alignItems: 'center',
  },
  countryBtnActive: { borderColor: colors.primary, backgroundColor: colors.primary + '22' },
  countryText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  countryTextActive: { color: colors.primary },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.bgCard,
  },
  typeChipActive: { borderColor: colors.primary, backgroundColor: colors.primary + '22' },
  typeText: { color: colors.textMuted, fontSize: 13 },
  typeTextActive: { color: colors.primary, fontWeight: '600' },
  btn: {
    backgroundColor: colors.primary, borderRadius: 12,
    padding: 16, alignItems: 'center', marginTop: 16,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: colors.white, fontSize: 17, fontWeight: '800' },
});
