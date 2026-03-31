import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '@/lib/colors';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="load/[id]" options={{ title: 'Load Details' }} />
        <Stack.Screen name="load/photos" options={{ title: 'Upload Photos' }} />
        <Stack.Screen name="load/documents" options={{ title: 'Documents' }} />
        <Stack.Screen name="load/exception" options={{ title: 'Report Exception' }} />
        <Stack.Screen name="load/messages" options={{ title: 'Messages' }} />
      </Stack>
    </>
  );
}
