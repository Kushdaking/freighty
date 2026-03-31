/**
 * OfflineIndicator — Shows a banner at the top of the screen when there's no internet.
 * Uses @react-native-community/netinfo to detect connectivity.
 */

import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { colors } from '@/lib/colors';

export default function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);
  const opacity = useState(new Animated.Value(0))[0];

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const offline = !state.isConnected || !state.isInternetReachable;
      setIsOffline(!!offline);

      if (!offline && wasOffline) {
        // Just reconnected — briefly show "Back online"
        setShowReconnected(true);
        setTimeout(() => setShowReconnected(false), 2500);
      }
      setWasOffline(!!offline);
    });

    return () => unsubscribe();
  }, [wasOffline]);

  useEffect(() => {
    const toValue = (isOffline || showReconnected) ? 1 : 0;
    Animated.timing(opacity, {
      toValue,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isOffline, showReconnected]);

  if (!isOffline && !showReconnected) return null;

  return (
    <Animated.View
      style={[
        styles.banner,
        isOffline ? styles.offlineBanner : styles.onlineBanner,
        { opacity },
      ]}
    >
      <Text style={styles.icon}>{isOffline ? '📵' : '✅'}</Text>
      <Text style={styles.text}>
        {isOffline ? 'No internet connection' : 'Back online'}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 8,
    zIndex: 9999,
  },
  offlineBanner: {
    backgroundColor: '#ef4444',
  },
  onlineBanner: {
    backgroundColor: '#22c55e',
  },
  icon: {
    fontSize: 14,
  },
  text: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.2,
  },
});
