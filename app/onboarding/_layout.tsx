import { Stack } from 'expo-router';
import { colors } from '@/lib/colors';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: colors.bg },
        headerBackTitle: 'Back',
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="account" options={{ title: 'Create Account', headerLeft: () => null }} />
      <Stack.Screen name="company" options={{ title: 'Company Info' }} />
      <Stack.Screen name="credentials" options={{ title: 'MC / DOT Numbers' }} />
      <Stack.Screen name="documents" options={{ title: 'Upload Documents' }} />
      <Stack.Screen name="complete" options={{ headerShown: false }} />
    </Stack>
  );
}
