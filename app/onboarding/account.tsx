import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/colors';

export default function AccountStep() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleNext() {
    if (!name.trim()) return Alert.alert('Required', 'Please enter your full name.');
    if (!email.trim()) return Alert.alert('Required', 'Please enter your email.');
    if (!phone.trim()) return Alert.alert('Required', 'Please enter your phone number.');
    if (password.length < 8) return Alert.alert('Password', 'Password must be at least 8 characters.');
    if (password !== confirm) return Alert.alert('Password', 'Passwords do not match.');

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: name.trim(), phone: phone.trim() },
        },
      });

      if (error) throw error;

      // Create carrier_users record
      if (data.user) {
        await supabase.from('carrier_users').insert({
          auth_user_id: data.user.id,
          email: email.trim(),
          name: name.trim(),
          phone: phone.trim(),
          is_active: true,
          is_verified: false,
          fmcsa_status: 'unknown',
          fmcsa_authority_status: 'unknown',
        });
      }

      router.push('/onboarding/company');
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Could not create account.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.stepIndicator}>
          <StepDot active num={1} />
          <StepLine />
          <StepDot num={2} />
          <StepLine />
          <StepDot num={3} />
          <StepLine />
          <StepDot num={4} />
        </View>
        <Text style={styles.heading}>Your Account</Text>
        <Text style={styles.sub}>Set up your carrier account to get started</Text>

        <Field label="Full Name" value={name} onChange={setName} placeholder="John Smith" />
        <Field label="Email" value={email} onChange={setEmail} placeholder="john@carrier.com" keyboardType="email-address" autoCapitalize="none" />
        <Field label="Phone Number" value={phone} onChange={setPhone} placeholder="+1 (555) 000-0000" keyboardType="phone-pad" />
        <Field label="Password" value={password} onChange={setPassword} placeholder="Min. 8 characters" secure />
        <Field label="Confirm Password" value={confirm} onChange={setConfirm} placeholder="Re-enter password" secure />

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
    </KeyboardAvoidingView>
  );
}

function Field({ label, value, onChange, placeholder, keyboardType, autoCapitalize, secure }: any) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textDim}
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize={autoCapitalize ?? 'words'}
        secureTextEntry={secure}
      />
    </View>
  );
}

function StepDot({ num, active }: { num: number; active?: boolean }) {
  return (
    <View style={[styles.dot, active && styles.dotActive]}>
      <Text style={[styles.dotText, active && styles.dotTextActive]}>{num}</Text>
    </View>
  );
}

function StepLine() {
  return <View style={styles.stepLine} />;
}

const styles = StyleSheet.create({
  content: { padding: 24, gap: 4 },
  stepIndicator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 24, gap: 0 },
  dot: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  dotActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  dotText: { color: colors.textMuted, fontWeight: '700', fontSize: 13 },
  dotTextActive: { color: colors.white },
  stepLine: { width: 32, height: 1, backgroundColor: colors.border },
  heading: { color: colors.text, fontSize: 26, fontWeight: '800', marginBottom: 4 },
  sub: { color: colors.textMuted, fontSize: 15, marginBottom: 16 },
  fieldWrap: { gap: 6, marginBottom: 12 },
  label: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  input: {
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, padding: 14, color: colors.text, fontSize: 16,
  },
  btn: {
    backgroundColor: colors.primary, borderRadius: 12,
    padding: 16, alignItems: 'center', marginTop: 12,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: colors.white, fontSize: 17, fontWeight: '800' },
});
