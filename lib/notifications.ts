import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  // Check/request permissions
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Push notification permission denied');
    return null;
  }

  // Android channel setup
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('loads', {
      name: 'New Loads',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2563eb',
    });
    await Notifications.setNotificationChannelAsync('messages', {
      name: 'Messages',
      importance: Notifications.AndroidImportance.HIGH,
    });
    await Notifications.setNotificationChannelAsync('status', {
      name: 'Status Updates',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  // Get push token
  const token = await Notifications.getExpoPushTokenAsync({
    projectId: 'freight-flow-carrier',
  });

  return token.data;
}

export async function savePushToken(token: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // Save to push_subscriptions table
  await supabase.from('push_subscriptions').upsert({
    user_id: user.id,
    endpoint: token,
    p256dh: token,
    auth: token,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
}

export async function setupPushNotifications() {
  const token = await registerForPushNotifications();
  if (token) {
    await savePushToken(token);
    return token;
  }
  return null;
}

// Send a push notification via Supabase Edge Function
export async function sendPushNotification(payload: {
  type: NotificationType;
  title: string;
  body: string;
  carrierUserId?: string;
  data?: Record<string, any>;
}) {
  try {
    await supabase.functions.invoke('send-notification', { body: payload });
  } catch (err) {
    console.error('Push notification failed:', err);
  }
}

// Notification types and handlers
export type NotificationType =
  | 'new_load'
  | 'load_update'
  | 'message'
  | 'payment'
  | 'verification';

export function getNotificationRoute(type: NotificationType, data: any): string | null {
  switch (type) {
    case 'new_load': return '/(tabs)/available';
    case 'load_update': return data?.shipmentId ? `/load/${data.shipmentId}` : '/(tabs)';
    case 'message': return data?.shipmentId ? `/load/messages?id=${data.shipmentId}` : '/(tabs)';
    case 'payment': return '/(tabs)/profile';
    case 'verification': return '/(tabs)/profile';
    default: return null;
  }
}
