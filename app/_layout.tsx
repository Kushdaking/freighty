import { useEffect, useRef } from 'react';
import { I18nProvider } from '@/lib/i18n';
import { View } from 'react-native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { colors } from '@/lib/colors';
import { setupPushNotifications, getNotificationRoute } from '@/lib/notifications';
import OfflineIndicator from '@/components/OfflineIndicator';

export default function RootLayout() {
  const notificationListener = useRef<any>();
  const responseListener = useRef<any>();

  useEffect(() => {
    // Register for push notifications
    setupPushNotifications();

    // Listen for incoming notifications while app is open
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
    });

    // Handle notification taps — navigate to the right screen
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const { type, ...data } = response.notification.request.content.data ?? {};
      const route = getNotificationRoute(type as any, data);
      if (route) router.push(route as any);
    });

    return () => {
      Notifications.removeNotificationSubscription(notificationListener.current);
      Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, []);

  return (
    <I18nProvider>
    <View style={{ flex: 1 }}>
      <StatusBar style="light" />
      <OfflineIndicator />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="load" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="vin-scanner" options={{ title: 'Scan VIN', presentation: 'modal' }} />
      </Stack>
    </View>
    </I18nProvider>
  );
}
