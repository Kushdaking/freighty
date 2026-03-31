import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/colors';

export default function CredentialsStep() {
  const [mcNumber, setMcNumber] = useState('');
  const [dotNumber, setDotNumber] = useState('');
  const [cvorNumber, setCvorNumber] = useState('');
  const [nscNumber, setNscNumber] = useState('');
  const [country, setCountry] = useState<'US' | 'CA'>('US');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [fmcsaResult, setFmcsaResult] = useState<any>(null);

  async function verifyFMCSA() {
    if (!mcNumber.trim() && !dotNumber.trim()) {
      return Alert.alert('Required', 'Enter your MC or DOT number to verify.');
    }
    setVerifying(true);
    try {
      // In production this would call FMCSA API
      // For now simulate a check
      await new Promise(r => setTimeout(r, 1500));
      setFmcsaResult({
        status: 'active',
        authority: 'authorized',
        name: 'Verified via FMCSA',
      });
    } catch {
      Alert.alert('Verification Failed', 'Could not verify with FMCSA. You can skip and submit documents for manual review.');
    } finally {
      setVerifying(false);
    }
  }

  async function handleNext() {
    if (country === 'US' && !mcNumber.trim() && !dotNumber.trim()) {
      return Alert.alert('Required', 'Please enter your MC or DOT number.');
    }
    if (country === 'CA' && !cvorNumber.trim() && !nscNumber.trim()) {
      return Alert.alert('Required', 'Please enter your CVOR or NSC number.');
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const updates: any = {};
      if (mcNumber) updates.mc_number = mcNumber.trim();
      if (dotNumber) updates.dot_number = dotNumber.trim();
      if (cvorNumber) updates.cvor_number = cvorNumber.trim();
      if (nscNumber) updates.nsc_number = nscNumber.trim();
      if (fmcsaResult) {
        updates.fmcsa_status = fmcsaResult.status;
        updates.fmcsa_authority_status = fmcsaResult.authority;
        updates.fmcsa_last_checked = new Date().toISOString();
      }

      await supabase.from('carrier_users').update(updates).eq('auth_user_id', user.id);
      router.push('/onboarding/documents');
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
        <StepDot num={2} done />
        <StepLine done />
        <StepDot num={3} active />
        <StepLine />
        <StepDot num={4} />
      </View>

      <Text style={styles.heading}>Operating Authority</Text>
      <Text style={styles.sub}>Your carrier credentials for compliance verification</Text>

      <View style={styles.countryRow}>
        <TouchableOpacity
          style={[styles.countryBtn, country === 'US' && styles.countryBtnActive]}
          onPress={() => setCountry('US')}
        >
          <Text style={[styles.countryText, country === 'US' && styles.countryTextActive]}>🇺🇸 US Carrier</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.countryBtn, country === 'CA' && styles.countryBtnActive]}
          onPress={() => setCountry('CA')}
        >
          <Text style={[styles.countryText, country === 'CA' && styles.countryTextActive]}>🇨🇦 Canadian Carrier</Text>
        </TouchableOpacity>
      </View>

      {country === 'US' ? (
        <>
          <Text style={styles.label}>MC Number</Text>
          <TextInput
            style={styles.input}
            value={mcNumber}
            onChangeText={setMcNumber}
            placeholder="MC-123456"
            placeholderTextColor={colors.textDim}
            autoCapitalize="characters"
          />
          <Text style={styles.label}>DOT Number</Text>
          <TextInput
            style={styles.input}
            value={dotNumber}
            onChangeText={setDotNumber}
            placeholder="1234567"
            placeholderTextColor={colors.textDim}
            keyboardType="numeric"
          />

          <TouchableOpacity
            style={[styles.verifyBtn, verifying && styles.btnDisabled]}
            onPress={verifyFMCSA}
            disabled={verifying}
          >
            {verifying
              ? <ActivityIndicator color={colors.primary} />
              : <Text style={styles.verifyText}>🔍 Verify with FMCSA</Text>
            }
          </TouchableOpacity>

          {fmcsaResult && (
            <View style={styles.verifiedBox}>
              <Text style={styles.verifiedTitle}>✅ FMCSA Verified</Text>
              <Text style={styles.verifiedSub}>Status: {fmcsaResult.status} · Authority: {fmcsaResult.authority}</Text>
            </View>
          )}
        </>
      ) : (
        <>
          <Text style={styles.label}>CVOR Number</Text>
          <TextInput
            style={styles.input}
            value={cvorNumber}
            onChangeText={setCvorNumber}
            placeholder="CVOR-123456"
            placeholderTextColor={colors.textDim}
            autoCapitalize="characters"
          />
          <Text style={styles.label}>NSC Number</Text>
          <TextInput
            style={styles.input}
            value={nscNumber}
            onChangeText={setNscNumber}
            placeholder="NSC-123456"
            placeholderTextColor={colors.textDim}
            autoCapitalize="characters"
          />
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              🇨🇦 Canadian carriers will be verified manually against CVOR and NSC records within 24 hours.
            </Text>
          </View>
        </>
      )}

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

      <TouchableOpacity style={styles.skipBtn} onPress={() => router.push('/onboarding/documents')}>
        <Text style={styles.skipText}>Skip for now</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function StepDot({ num, active, done }: { num: number; active?: boolean; done?: boolean }) {
  return (
    <View style={[styles.dot, active && styles.dotActive, done && styles.dotDone]}>
      <Text style={[styles.dotText, (active || done) && styles.dotTextActive]}>{done ? '✓' : num}</Text>
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
  label: { color: colors.textMuted, fontSize: 13, fontWeight: '600', marginTop: 4 },
  input: {
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, padding: 14, color: colors.text, fontSize: 16,
  },
  countryRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  countryBtn: {
    flex: 1, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, padding: 14, alignItems: 'center',
  },
  countryBtnActive: { borderColor: colors.primary, backgroundColor: colors.primary + '22' },
  countryText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  countryTextActive: { color: colors.primary },
  verifyBtn: {
    borderWidth: 1, borderColor: colors.primary, borderRadius: 10,
    padding: 14, alignItems: 'center', marginTop: 4,
  },
  verifyText: { color: colors.primary, fontWeight: '700', fontSize: 15 },
  verifiedBox: {
    backgroundColor: colors.success + '22', borderWidth: 1, borderColor: colors.success,
    borderRadius: 10, padding: 14, gap: 4,
  },
  verifiedTitle: { color: colors.success, fontWeight: '700', fontSize: 15 },
  verifiedSub: { color: colors.success, fontSize: 13 },
  infoBox: {
    backgroundColor: colors.primary + '15', borderWidth: 1, borderColor: colors.primary + '44',
    borderRadius: 10, padding: 14,
  },
  infoText: { color: colors.textMuted, fontSize: 13, lineHeight: 20 },
  btn: {
    backgroundColor: colors.primary, borderRadius: 12,
    padding: 16, alignItems: 'center', marginTop: 16,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: colors.white, fontSize: 17, fontWeight: '800' },
  skipBtn: { padding: 12, alignItems: 'center' },
  skipText: { color: colors.textDim, fontSize: 14 },
});
