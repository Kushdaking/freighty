import { useEffect, useState } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/colors';

export default function RootLayout() {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/login');
      }
      setInitialized(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') router.replace('/login');
      if (event === 'SIGNED_IN') router.replace('/(tabs)');
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!initialized) return null;

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
