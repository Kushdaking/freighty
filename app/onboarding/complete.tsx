import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { colors } from '@/lib/colors';

export default function OnboardingComplete() {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.icon}>🎉</Text>
        <Text style={styles.title}>You're all set!</Text>
        <Text style={styles.sub}>
          Your application has been submitted for review. We'll verify your documents within 24 hours.
        </Text>

        <View style={styles.steps}>
          <Step icon="✅" text="Account created" done />
          <Step icon="✅" text="Company info saved" done />
          <Step icon="✅" text="Credentials submitted" done />
          <Step icon="⏳" text="Documents under review" pending />
          <Step icon="🔒" text="Start accepting loads" locked />
        </View>

        <View style={styles.note}>
          <Text style={styles.noteText}>
            💬 You'll receive a notification once your account is approved. In the meantime, you can browse the app.
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.btn}
        onPress={() => router.replace('/(tabs)')}
      >
        <Text style={styles.btnText}>Go to Dashboard</Text>
      </TouchableOpacity>
    </View>
  );
}

function Step({ icon, text, done, pending, locked }: any) {
  return (
    <View style={styles.step}>
      <Text style={styles.stepIcon}>{icon}</Text>
      <Text style={[
        styles.stepText,
        done && styles.stepDone,
        pending && styles.stepPending,
        locked && styles.stepLocked,
      ]}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 28, justifyContent: 'space-between' },
  content: { flex: 1, justifyContent: 'center', gap: 20 },
  icon: { fontSize: 72, textAlign: 'center' },
  title: { color: colors.text, fontSize: 32, fontWeight: '800', textAlign: 'center' },
  sub: { color: colors.textMuted, fontSize: 16, textAlign: 'center', lineHeight: 24 },
  steps: {
    backgroundColor: colors.bgCard, borderRadius: 14,
    borderWidth: 1, borderColor: colors.border, padding: 18, gap: 14,
  },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepIcon: { fontSize: 20 },
  stepText: { fontSize: 15, color: colors.textMuted },
  stepDone: { color: colors.success, fontWeight: '600' },
  stepPending: { color: colors.accent, fontWeight: '600' },
  stepLocked: { color: colors.textDim },
  note: {
    backgroundColor: colors.primary + '15', borderRadius: 10,
    borderWidth: 1, borderColor: colors.primary + '33', padding: 16,
  },
  noteText: { color: colors.textMuted, fontSize: 14, lineHeight: 22 },
  btn: {
    backgroundColor: colors.primary, borderRadius: 14,
    padding: 18, alignItems: 'center', marginBottom: 10,
  },
  btnText: { color: colors.white, fontSize: 18, fontWeight: '800' },
});
