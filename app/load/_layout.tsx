import { Stack } from 'expo-router';
import { colors } from '@/lib/colors';

export default function LoadLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="[id]" options={{ title: 'Load Details' }} />
      <Stack.Screen name="photos" options={{ title: 'Upload Photos' }} />
      <Stack.Screen name="condition" options={{ title: 'Condition Report' }} />
      <Stack.Screen name="documents" options={{ title: 'Documents' }} />
      <Stack.Screen name="exception" options={{ title: 'Report Exception' }} />
      <Stack.Screen name="messages" options={{ title: 'Messages' }} />
    </Stack>
  );
}
