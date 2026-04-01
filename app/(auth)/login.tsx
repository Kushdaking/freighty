import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Image,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
  StatusBar,
} from 'react-native';
import Svg, { Path, Circle, Polygon, Rect, G, Defs, LinearGradient, Stop } from 'react-native-svg';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';

const GOLD = '#C9A84C';
const SLATE = '#0a0f1a';
const CARD = '#111827';
const BORDER = '#1e2d40';
const TEXT = '#f0f4f8';
const DIM = '#a8c4d8';
const FAINT = '#4a6580';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) return Alert.alert('Missing Info', 'Please enter your email and password.');
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      Alert.alert('Login Failed', error.message);
    } else if (data.session) {
      router.replace('/(tabs)');
    }
  }

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="light-content" backgroundColor={SLATE} />

      <View style={s.inner}>
        {/* Prevayl Logo + Wordmark */}
        <View style={s.logoSection}>
          {/* SVG Logo Mark */}
          <View style={s.logoMark}>
            <Svg width={80} height={80} viewBox="0 0 100 100">
              <Defs>
                <LinearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#D4AF5A" />
                  <Stop offset="1" stopColor="#A8832A" />
                </LinearGradient>
              </Defs>
              {/* Map outline shape */}
              <Path
                d="M50 8 C30 8 14 24 14 44 C14 64 50 92 50 92 C50 92 86 64 86 44 C86 24 70 8 50 8 Z"
                fill="url(#goldGrad)"
              />
              {/* Inner circle */}
              <Circle cx={50} cy={44} r={14} fill="#0a0f1a" />
              {/* Route dot */}
              <Circle cx={50} cy={44} r={6} fill="#C9A84C" />
              {/* Dashed route lines */}
              <Path d="M30 30 L50 44" stroke="#ffffff" strokeWidth={2} strokeDasharray="3,3" opacity={0.5} />
              <Path d="M50 44 L70 35" stroke="#ffffff" strokeWidth={2} strokeDasharray="3,3" opacity={0.5} />
            </Svg>
          </View>
          <Text style={s.wordmark}>PREVAYL</Text>
          <Text style={s.tagline}>MOVE SMARTER. PREVAYL.</Text>
          <View style={s.portalBadge}>
            <Text style={s.portalText}>CARRIER PORTAL</Text>
          </View>
        </View>

        {/* Form card */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Sign In</Text>
          <Text style={s.cardSubtitle}>Access your loads, earnings, and dispatch</Text>

          <View style={s.fieldGroup}>
            <Text style={s.label}>EMAIL</Text>
            <TextInput
              style={s.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={FAINT}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
          </View>

          <View style={s.fieldGroup}>
            <Text style={s.label}>PASSWORD</Text>
            <TextInput
              style={s.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={FAINT}
              secureTextEntry
              autoComplete="password"
            />
          </View>

          <TouchableOpacity
            style={[s.button, loading && s.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={SLATE} />
              : <Text style={s.buttonText}>SIGN IN →</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity
            style={s.registerBtn}
            onPress={() => router.push('/onboarding')}
            activeOpacity={0.7}
          >
            <Text style={s.registerText}>New carrier? Create an account</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.footer}>© 2026 Prevaylos Inc. — EIN 41-5226132</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: SLATE },
  inner: { flex: 1, justifyContent: 'center', padding: 24 },

  // Logo section
  logoSection: { alignItems: 'center', marginBottom: 32 },
  logoMark: {
    width: 72, height: 72, borderRadius: 18,
    backgroundColor: 'rgba(201,168,76,0.12)',
    borderWidth: 1.5, borderColor: 'rgba(201,168,76,0.4)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
  },
  logoIcon: { fontSize: 36 },
  wordmark: {
    fontSize: 42, fontWeight: '900', color: GOLD,
    letterSpacing: 6, marginBottom: 4,
  },
  tagline: {
    fontSize: 11, color: DIM, letterSpacing: 2,
    fontWeight: '600', marginBottom: 14,
  },
  portalBadge: {
    backgroundColor: 'rgba(201,168,76,0.1)',
    borderWidth: 1, borderColor: 'rgba(201,168,76,0.3)',
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 5,
  },
  portalText: { color: GOLD, fontSize: 12, fontWeight: '800', letterSpacing: 2 },

  // Card
  card: {
    backgroundColor: CARD,
    borderWidth: 1, borderColor: BORDER,
    borderRadius: 16, padding: 24,
    marginBottom: 16,
  },
  cardTitle: { color: TEXT, fontSize: 22, fontWeight: '800', marginBottom: 4 },
  cardSubtitle: { color: DIM, fontSize: 13, marginBottom: 24 },

  // Fields
  fieldGroup: { marginBottom: 16 },
  label: {
    color: GOLD, fontSize: 11, fontWeight: '700',
    letterSpacing: 1.5, marginBottom: 8,
  },
  input: {
    backgroundColor: '#0d1520',
    borderWidth: 1, borderColor: BORDER,
    borderRadius: 10, padding: 14,
    color: TEXT, fontSize: 16,
  },

  // Button
  button: {
    backgroundColor: GOLD,
    borderRadius: 12, padding: 17,
    alignItems: 'center', marginTop: 8,
    shadowColor: GOLD, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: SLATE, fontSize: 16, fontWeight: '900', letterSpacing: 1 },

  // Register
  registerBtn: { padding: 14, alignItems: 'center' },
  registerText: { color: DIM, fontSize: 14, fontWeight: '600' },

  // Footer
  footer: { color: FAINT, fontSize: 11, textAlign: 'center', marginTop: 8 },
});
