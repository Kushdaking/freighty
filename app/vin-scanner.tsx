/**
 * VIN Scanner Screen
 * Camera-based VIN capture using expo-camera barcode scanning.
 * Usage: router.push('/vin-scanner?callback=vinScanned')
 * Result is passed back via router params.
 */

import { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Vibration, Alert,
} from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { colors } from '@/lib/colors';

const VIN_REGEX = /^[A-HJ-NPR-Z0-9]{17}$/;

function cleanVin(raw: string): string {
  return raw.replace(/[^A-HJ-NPR-Z0-9a-hj-npr-z0-9]/g, '').toUpperCase();
}

export default function VINScannerScreen() {
  const { returnTo, field } = useLocalSearchParams<{ returnTo: string; field: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [lastScan, setLastScan] = useState('');
  const [torch, setTorch] = useState(false);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleBarcodeScan = useCallback((result: BarcodeScanningResult) => {
    if (scanned) return;

    const raw = result.data;
    const vin = cleanVin(raw);

    // Debounce repeated scans
    if (vin === lastScan) return;
    setLastScan(vin);

    if (!VIN_REGEX.test(vin)) {
      // Not a VIN — could be a partial, ignore silently
      return;
    }

    setScanned(true);
    Vibration.vibrate(100);

    Alert.alert(
      'VIN Captured',
      `${vin}\n\nUse this VIN?`,
      [
        {
          text: 'Retry',
          style: 'cancel',
          onPress: () => {
            setScanned(false);
            setLastScan('');
          },
        },
        {
          text: 'Use VIN',
          onPress: () => {
            // Navigate back with the VIN as a param
            router.back();
            // Use a small delay to let navigation settle before pushing param
            setTimeout(() => {
              router.setParams({ scannedVin: vin, vinField: field || 'vin' });
            }, 50);
          },
        },
      ]
    );
  }, [scanned, lastScan, field]);

  if (!permission) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.icon}>📷</Text>
        <Text style={styles.title}>Camera Access Required</Text>
        <Text style={styles.subtitle}>Allow camera access to scan VIN barcodes</Text>
        <TouchableOpacity style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkBtn} onPress={() => router.back()}>
          <Text style={styles.linkText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Scan VIN',
          headerStyle: { backgroundColor: '#000' },
          headerTintColor: '#fff',
          headerRight: () => (
            <TouchableOpacity onPress={() => setTorch(t => !t)} style={{ marginRight: 4 }}>
              <Text style={{ fontSize: 22 }}>{torch ? '🔦' : '💡'}</Text>
            </TouchableOpacity>
          ),
        }}
      />

      <CameraView
        style={styles.camera}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{
          barcodeTypes: ['code39', 'code128', 'pdf417', 'datamatrix', 'qr'],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScan}
      >
        {/* Overlay */}
        <View style={styles.overlay}>
          {/* Top dark area */}
          <View style={styles.overlayEdge} />

          {/* Middle row with side panels + scan zone */}
          <View style={styles.middleRow}>
            <View style={styles.overlaySide} />

            {/* Scan zone */}
            <View style={styles.scanZone}>
              {/* Corner marks */}
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />

              {/* Scan line animation placeholder */}
              <View style={styles.scanLine} />
            </View>

            <View style={styles.overlaySide} />
          </View>

          {/* Bottom dark area with instructions */}
          <View style={styles.overlayBottom}>
            <Text style={styles.instructionText}>
              Point camera at the VIN barcode
            </Text>
            <Text style={styles.instructionSub}>
              Usually on the driver's door jamb or dashboard
            </Text>

            <View style={styles.bottomBtns}>
              <TouchableOpacity
                style={styles.torchBtn}
                onPress={() => setTorch(t => !t)}
              >
                <Text style={styles.torchBtnText}>{torch ? '🔦 Torch On' : '💡 Torch Off'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => router.back()}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </CameraView>
    </View>
  );
}

const CORNER_SIZE = 24;
const CORNER_THICKNESS = 3;
const CORNER_COLOR = '#3b82f6';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  icon: { fontSize: 48, marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '800', color: colors.text, textAlign: 'center' },
  subtitle: { fontSize: 14, color: colors.textDim, marginTop: 8, textAlign: 'center', lineHeight: 20 },
  text: { fontSize: 14, color: colors.textDim },
  btn: {
    marginTop: 24,
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  linkBtn: { marginTop: 12 },
  linkText: { color: colors.textDim, fontSize: 14 },
  overlay: { flex: 1 },
  overlayEdge: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  overlayBottom: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  middleRow: { flexDirection: 'row', height: 120 },
  overlaySide: { width: 40, backgroundColor: 'rgba(0,0,0,0.6)' },
  scanZone: {
    flex: 1,
    borderWidth: 0,
    position: 'relative',
    overflow: 'hidden',
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: CORNER_COLOR,
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS },
  cornerTR: { top: 0, right: 0, borderTopWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    height: 2,
    backgroundColor: CORNER_COLOR,
    opacity: 0.8,
  },
  instructionText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  instructionSub: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 20,
  },
  bottomBtns: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  torchBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  torchBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  cancelText: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },
});
