import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { router } from 'expo-router';
import { colors } from '@/lib/colors';

export default function OnboardingWelcome() {
  return (
    <View style={styles.container}>
      <View style={styles.top}>
        <Text style={styles.logo}>🚛</Text>
        <Text style={styles.title}>Freight Flow</Text>
        <Text style={styles.subtitle}>Carrier Portal</Text>
      </View>

      <View style={styles.features}>
        <Feature icon="📦" text="View and accept available loads" />
        <Feature icon="📍" text="Real-time GPS tracking" />
        <Feature icon="📷" text="Digital vehicle inspections" />
        <Feature icon="💬" text="Direct dispatcher messaging" />
        <Feature icon="💰" text="Track your earnings" />
      </View>

      <View style={styles.bottom}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => router.push('/onboarding/account')}
        >
          <Text style={styles.primaryBtnText}>Get Started</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => router.replace('/(auth)/login')}
        >
          <Text style={styles.secondaryBtnText}>Already have an account? Sign In</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Feature({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.feature}>
      <Text style={styles.featureIcon}>{icon}</Text>
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 28, justifyContent: 'space-between' },
  top: { alignItems: 'center', paddingTop: 60, gap: 8 },
  logo: { fontSize: 64 },
  title: { fontSize: 36, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 18, color: colors.textMuted },
  features: { gap: 18 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  featureIcon: { fontSize: 28, width: 40, textAlign: 'center' },
  featureText: { color: colors.text, fontSize: 16, flex: 1 },
  bottom: { gap: 12, paddingBottom: 20 },
  primaryBtn: {
    backgroundColor: colors.primary, borderRadius: 14,
    padding: 18, alignItems: 'center',
  },
  primaryBtnText: { color: colors.white, fontSize: 18, fontWeight: '800' },
  secondaryBtn: { padding: 12, alignItems: 'center' },
  secondaryBtnText: { color: colors.textMuted, fontSize: 15 },
});
