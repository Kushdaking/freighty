/**
 * Receipt Scanner Screen
 * Camera capture → OCR via Google Vision → auto-fill expense form
 * Usage: router.push('/receipt-scanner')
 * On success: navigates to expenses tab with pre-filled data
 */

import { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator,
  ScrollView, TextInput, Modal, Image, Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { router, Stack } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/colors';

const SUPABASE_URL = 'https://ruyulhpkuxcjoylxrfyz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1eXVsaHBrdXhjam95bHhyZnl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4ODY0MTgsImV4cCI6MjA5MDQ2MjQxOH0.83RMuNlboUetr_16j9BCZ8-xjDtjpnK9MaKJxQoBBgg';

interface ParsedReceipt {
  type: string;
  amount: string;
  vendor: string;
  date: string;
  gallons: string;
  price_per_gallon: string;
  location: string;
  notes: string;
}

const EMPTY_RECEIPT: ParsedReceipt = {
  type: 'fuel', amount: '', vendor: '', date: '', gallons: '',
  price_per_gallon: '', location: '', notes: '',
};

const EXPENSE_TYPES = ['fuel', 'toll', 'repair', 'lodging', 'food', 'permit', 'other'];
const TYPE_ICONS: Record<string, string> = {
  fuel: '⛽', toll: '🛣️', repair: '🔧', lodging: '🏨',
  food: '🍔', permit: '📋', other: '📄',
};

function parseReceiptText(text: string): Partial<ParsedReceipt> {
  const result: Partial<ParsedReceipt> = {};
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const lower = text.toLowerCase();

  // Detect type
  if (/diesel|fuel|gas|gallon|gal\b|unleaded|regular|premium/i.test(text)) {
    result.type = 'fuel';
  } else if (/toll|turnpike|e-zpass|pike/i.test(text)) {
    result.type = 'toll';
  } else if (/hotel|motel|inn|lodging|stay|nights?/i.test(text)) {
    result.type = 'lodging';
  } else if (/repair|service|mechanic|shop|parts|labor/i.test(text)) {
    result.type = 'repair';
  } else if (/restaurant|café|diner|food|eat|mcdonald|subway|burger|wendy/i.test(text)) {
    result.type = 'food';
  } else {
    result.type = 'other';
  }

  // Extract total amount — look for largest dollar amount near "total"
  const totalMatch = text.match(/(?:total|amount|due|charged?)[^\d]*\$?\s*(\d+\.?\d{0,2})/i);
  const amounts = [...text.matchAll(/\$\s*(\d+\.?\d{0,2})/g)].map(m => parseFloat(m[1]));
  if (totalMatch) {
    result.amount = parseFloat(totalMatch[1]).toFixed(2);
  } else if (amounts.length > 0) {
    result.amount = Math.max(...amounts).toFixed(2);
  }

  // Extract gallons
  const gallonsMatch = text.match(/(\d+\.?\d{0,3})\s*(?:gal(?:lons?)?|g(?:al)?\.)/i);
  if (gallonsMatch) result.gallons = parseFloat(gallonsMatch[1]).toFixed(3);

  // Price per gallon
  const ppgMatch = text.match(/(\d+\.\d{3})\s*(?:\/gal|per gal)/i) ||
    text.match(/(?:price|rate|ppg)[^\d]*(\d+\.\d{2,3})/i);
  if (ppgMatch) result.price_per_gallon = parseFloat(ppgMatch[1]).toFixed(3);

  // If we have gallons and no ppg, try calculating
  if (result.gallons && result.amount && !result.price_per_gallon) {
    const ppg = parseFloat(result.amount) / parseFloat(result.gallons);
    if (ppg > 2 && ppg < 8) result.price_per_gallon = ppg.toFixed(3);
  }

  // Date — various formats
  const dateMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (dateMatch) {
    const [, m, d, y] = dateMatch;
    const year = y.length === 2 ? `20${y}` : y;
    const mo = m.padStart(2, '0');
    const dy = d.padStart(2, '0');
    result.date = `${year}-${mo}-${dy}`;
  }

  // Vendor — often first non-empty line or line after "welcome to"
  const vendorLine = lines.find(l =>
    l.length > 2 && l.length < 40 &&
    !l.match(/^\d/) &&
    !l.match(/receipt|invoice|thank|date|time|trans/i)
  );
  if (vendorLine) result.vendor = vendorLine;

  // Location — city/state pattern
  const locationMatch = text.match(/([A-Z][a-z]+(?:\s[A-Z][a-z]+)*),?\s+([A-Z]{2})\s+\d{5}/);
  if (locationMatch) result.location = `${locationMatch[1]}, ${locationMatch[2]}`;

  return result;
}

async function performOCR(imageBase64: string): Promise<string> {
  // Use Google Cloud Vision API via our dashboard proxy
  // Falls back to basic pattern matching if unavailable
  try {
    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=AIzaSyDemo`, // Demo key — replace with real key in .env
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{
            image: { content: imageBase64 },
            features: [{ type: 'TEXT_DETECTION', maxResults: 1 }],
          }],
        }),
      }
    );
    if (response.ok) {
      const data = await response.json();
      return data.responses?.[0]?.fullTextAnnotation?.text || '';
    }
  } catch {}
  
  // Fallback: return empty (user fills manually)
  return '';
}

async function uploadReceiptImage(imageUri: string, carrierId: string): Promise<string | null> {
  try {
    const filename = `receipt-${Date.now()}.jpg`;
    const path = `${carrierId}/receipts/${filename}`;
    
    const response = await fetch(imageUri);
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    const { data, error } = await supabase.storage
      .from('carrier-profiles')
      .upload(path, uint8Array, { contentType: 'image/jpeg', upsert: false });

    if (error) return null;
    
    const { data: urlData } = supabase.storage
      .from('carrier-profiles')
      .getPublicUrl(data.path);
    
    return urlData.publicUrl || null;
  } catch {
    return null;
  }
}

export default function ReceiptScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<'camera' | 'review' | 'edit'>('camera');
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string>('');
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [parsed, setParsed] = useState<ParsedReceipt>(EMPTY_RECEIPT);
  const cameraRef = useRef<any>(null);

  const takePicture = useCallback(async () => {
    if (!cameraRef.current) return;
    setProcessing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: true,
        skipProcessing: false,
      });
      setCapturedUri(photo.uri);
      setImageBase64(photo.base64 || '');
      
      // Run OCR
      const text = await performOCR(photo.base64 || '');
      const extracted = parseReceiptText(text);
      setParsed({ ...EMPTY_RECEIPT, ...extracted, date: extracted.date || new Date().toISOString().split('T')[0] });
      setMode('review');
    } catch (e) {
      Alert.alert('Error', 'Failed to capture photo');
    } finally {
      setProcessing(false);
    }
  }, []);

  const pickFromGallery = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      setProcessing(true);
      const asset = result.assets[0];
      setCapturedUri(asset.uri);
      setImageBase64(asset.base64 || '');
      const text = await performOCR(asset.base64 || '');
      const extracted = parseReceiptText(text);
      setParsed({ ...EMPTY_RECEIPT, ...extracted, date: extracted.date || new Date().toISOString().split('T')[0] });
      setMode('review');
      setProcessing(false);
    }
  }, []);

  const saveExpense = useCallback(async () => {
    if (!parsed.amount || parseFloat(parsed.amount) <= 0) {
      Alert.alert('Missing Amount', 'Please enter the expense amount.');
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get carrier record
      const { data: carrier } = await supabase
        .from('carrier_users')
        .select('id')
        .eq('email', user.email)
        .single();
      
      if (!carrier) throw new Error('Carrier profile not found');

      // Upload image
      let receiptUrl: string | null = null;
      if (capturedUri) {
        receiptUrl = await uploadReceiptImage(capturedUri, carrier.id);
      }

      // Save to carrier_receipts
      const { error } = await supabase.from('carrier_receipts').insert({
        carrier_id: carrier.id,
        date: parsed.date || new Date().toISOString().split('T')[0],
        type: parsed.type,
        amount: parseFloat(parsed.amount) || 0,
        gallons: parsed.gallons ? parseFloat(parsed.gallons) : null,
        price_per_gallon: parsed.price_per_gallon ? parseFloat(parsed.price_per_gallon) : null,
        location: parsed.location || null,
        vendor: parsed.vendor || null,
        notes: parsed.notes || null,
        receipt_url: receiptUrl,
      });

      if (error) throw error;

      Alert.alert('✅ Saved!', 'Receipt logged to your expenses.', [
        { text: 'OK', onPress: () => router.replace('/(tabs)/earnings') },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save receipt');
    } finally {
      setSaving(false);
    }
  }, [parsed, capturedUri]);

  if (!permission) return <View style={s.container}><ActivityIndicator color={colors.primary} /></View>;

  if (!permission.granted) {
    return (
      <View style={s.container}>
        <Stack.Screen options={{ title: 'Receipt Scanner', headerStyle: { backgroundColor: '#111827' }, headerTintColor: '#f0f4f8' }} />
        <Text style={s.permText}>Camera permission required</Text>
        <TouchableOpacity style={s.btn} onPress={requestPermission}>
          <Text style={s.btnText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Camera view
  if (mode === 'camera') {
    return (
      <View style={s.container}>
        <Stack.Screen options={{ title: 'Scan Receipt', headerStyle: { backgroundColor: '#0a0f1a' }, headerTintColor: '#f0f4f8', headerLeft: () => (
          <TouchableOpacity onPress={() => router.back()} style={{ paddingHorizontal: 16 }}>
            <Text style={{ color: '#C9A84C', fontSize: 16 }}>← Back</Text>
          </TouchableOpacity>
        )}} />
        <CameraView ref={cameraRef} style={s.camera} facing="back">
          {/* Overlay guide */}
          <View style={s.overlay}>
            <Text style={s.overlayTitle}>RECEIPT SCANNER</Text>
            <Text style={s.overlaySubtitle}>Position receipt within the frame</Text>
            
            {/* Corner guides */}
            <View style={s.frame}>
              <View style={[s.corner, s.tl]} />
              <View style={[s.corner, s.tr]} />
              <View style={[s.corner, s.bl]} />
              <View style={[s.corner, s.br]} />
            </View>

            <Text style={s.hint}>Ensure text is clear and well-lit</Text>
          </View>
        </CameraView>

        {/* Controls */}
        <View style={s.controls}>
          <TouchableOpacity style={s.galleryBtn} onPress={pickFromGallery}>
            <Text style={{ fontSize: 24 }}>🖼️</Text>
            <Text style={s.galleryText}>Gallery</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.captureBtn} onPress={takePicture} disabled={processing}>
            {processing
              ? <ActivityIndicator color="#0a0f1a" />
              : <View style={s.captureInner} />
            }
          </TouchableOpacity>

          <TouchableOpacity style={s.manualBtn} onPress={() => {
            setParsed({ ...EMPTY_RECEIPT, date: new Date().toISOString().split('T')[0] });
            setMode('edit');
          }}>
            <Text style={{ fontSize: 24 }}>✏️</Text>
            <Text style={s.galleryText}>Manual</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Review / Edit view
  return (
    <View style={s.container}>
      <Stack.Screen options={{ title: 'Review Receipt', headerStyle: { backgroundColor: '#0a0f1a' }, headerTintColor: '#f0f4f8', headerLeft: () => (
        <TouchableOpacity onPress={() => setMode('camera')} style={{ paddingHorizontal: 16 }}>
          <Text style={{ color: '#C9A84C', fontSize: 16 }}>← Retake</Text>
        </TouchableOpacity>
      )}} />
      
      <ScrollView style={s.scroll} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Receipt image preview */}
        {capturedUri && (
          <View style={s.previewContainer}>
            <Image source={{ uri: capturedUri }} style={s.previewImage} resizeMode="contain" />
            <View style={s.previewBadge}>
              <Text style={s.previewBadgeText}>📷 CAPTURED</Text>
            </View>
          </View>
        )}

        {/* OCR Status */}
        <View style={s.ocrBanner}>
          <Text style={s.ocrIcon}>{capturedUri ? '🤖' : '✏️'}</Text>
          <Text style={s.ocrText}>
            {capturedUri ? 'AI extracted — review and edit below' : 'Enter receipt details manually'}
          </Text>
        </View>

        {/* Expense Type */}
        <View style={s.section}>
          <Text style={s.label}>EXPENSE TYPE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
            {EXPENSE_TYPES.map(t => (
              <TouchableOpacity key={t} onPress={() => setParsed(p => ({ ...p, type: t }))}
                style={[s.typePill, parsed.type === t && s.typePillActive]}>
                <Text style={[s.typePillText, parsed.type === t && s.typePillTextActive]}>
                  {TYPE_ICONS[t]} {t.charAt(0).toUpperCase() + t.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Amount */}
        <View style={s.section}>
          <Text style={s.label}>TOTAL AMOUNT *</Text>
          <View style={s.amountRow}>
            <Text style={s.dollarSign}>$</Text>
            <TextInput
              style={[s.input, s.amountInput]}
              value={parsed.amount}
              onChangeText={v => setParsed(p => ({ ...p, amount: v }))}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor="#4a6580"
            />
          </View>
        </View>

        {/* Fuel fields */}
        {parsed.type === 'fuel' && (
          <View style={s.fuelSection}>
            <Text style={s.sectionTitle}>⛽ FUEL DETAILS</Text>
            <View style={s.row}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={s.label}>GALLONS</Text>
                <TextInput style={s.input} value={parsed.gallons}
                  onChangeText={v => setParsed(p => ({ ...p, gallons: v }))}
                  keyboardType="decimal-pad" placeholder="0.000" placeholderTextColor="#4a6580" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>PRICE/GAL</Text>
                <View style={[s.amountRow, { flex: 0 }]}>
                  <Text style={s.dollarSign}>$</Text>
                  <TextInput style={[s.input, { flex: 1 }]} value={parsed.price_per_gallon}
                    onChangeText={v => setParsed(p => ({ ...p, price_per_gallon: v }))}
                    keyboardType="decimal-pad" placeholder="0.000" placeholderTextColor="#4a6580" />
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Date */}
        <View style={s.section}>
          <Text style={s.label}>DATE</Text>
          <TextInput style={s.input} value={parsed.date}
            onChangeText={v => setParsed(p => ({ ...p, date: v }))}
            placeholder="YYYY-MM-DD" placeholderTextColor="#4a6580" />
        </View>

        {/* Vendor */}
        <View style={s.section}>
          <Text style={s.label}>VENDOR</Text>
          <TextInput style={s.input} value={parsed.vendor}
            onChangeText={v => setParsed(p => ({ ...p, vendor: v }))}
            placeholder="Pilot Flying J, Love's, etc." placeholderTextColor="#4a6580" />
        </View>

        {/* Location */}
        <View style={s.section}>
          <Text style={s.label}>LOCATION</Text>
          <TextInput style={s.input} value={parsed.location}
            onChangeText={v => setParsed(p => ({ ...p, location: v }))}
            placeholder="City, State" placeholderTextColor="#4a6580" />
        </View>

        {/* Notes */}
        <View style={s.section}>
          <Text style={s.label}>NOTES</Text>
          <TextInput style={[s.input, s.textArea]} value={parsed.notes}
            onChangeText={v => setParsed(p => ({ ...p, notes: v }))}
            placeholder="Any additional details..." placeholderTextColor="#4a6580"
            multiline numberOfLines={3} />
        </View>

        {/* Save button */}
        <TouchableOpacity style={[s.saveBtn, saving && s.saveBtnDisabled]}
          onPress={saveExpense} disabled={saving}>
          {saving
            ? <ActivityIndicator color="#0a0f1a" />
            : <Text style={s.saveBtnText}>💾 SAVE EXPENSE</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity style={s.cancelBtn} onPress={() => router.back()}>
          <Text style={s.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0f1a' },
  camera: { flex: 1 },
  scroll: { flex: 1, padding: 16 },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'space-between', paddingVertical: 40 },
  overlayTitle: { color: '#C9A84C', fontSize: 22, fontWeight: '800', letterSpacing: 2 },
  overlaySubtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },
  hint: { color: 'rgba(255,255,255,0.5)', fontSize: 13, textAlign: 'center', paddingHorizontal: 40 },
  frame: {
    width: 280, height: 180, position: 'relative',
    borderColor: 'transparent',
  },
  corner: { position: 'absolute', width: 24, height: 24, borderColor: '#C9A84C', borderWidth: 3 },
  tl: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  tr: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  bl: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  br: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  controls: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    paddingVertical: 24, paddingHorizontal: 20, backgroundColor: '#111827',
    borderTopWidth: 1, borderTopColor: '#1e2d40',
  },
  captureBtn: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: '#C9A84C',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#C9A84C', shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  captureInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#f0f4f8' },
  galleryBtn: { alignItems: 'center', gap: 4, width: 64 },
  manualBtn: { alignItems: 'center', gap: 4, width: 64 },
  galleryText: { color: '#a8c4d8', fontSize: 12 },
  permText: { color: '#f0f4f8', fontSize: 16, textAlign: 'center', margin: 24 },
  btn: { backgroundColor: '#C9A84C', padding: 14, borderRadius: 10, margin: 24, alignItems: 'center' },
  btnText: { color: '#0a0f1a', fontWeight: '800', fontSize: 16 },
  previewContainer: { borderRadius: 12, overflow: 'hidden', marginBottom: 16, position: 'relative' },
  previewImage: { width: '100%', height: 180, backgroundColor: '#0d1520' },
  previewBadge: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: 'rgba(52,211,153,0.9)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4,
  },
  previewBadgeText: { color: '#0a0f1a', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  ocrBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(201,168,76,0.08)', borderWidth: 1, borderColor: 'rgba(201,168,76,0.2)',
    borderRadius: 10, padding: 12, marginBottom: 20,
  },
  ocrIcon: { fontSize: 20 },
  ocrText: { color: '#a8c4d8', fontSize: 14, flex: 1 },
  section: { marginBottom: 16 },
  fuelSection: {
    backgroundColor: 'rgba(96,165,250,0.06)', borderWidth: 1, borderColor: 'rgba(96,165,250,0.2)',
    borderRadius: 12, padding: 14, marginBottom: 16,
  },
  sectionTitle: { color: '#60a5fa', fontSize: 14, fontWeight: '700', marginBottom: 12, letterSpacing: 1 },
  label: { color: '#a8c4d8', fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 6 },
  input: {
    backgroundColor: '#111827', borderWidth: 1, borderColor: '#1e2d40',
    borderRadius: 10, padding: 12, color: '#f0f4f8', fontSize: 16,
  },
  textArea: { height: 80, textAlignVertical: 'top' },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dollarSign: { color: '#34d399', fontSize: 22, fontWeight: '800' },
  amountInput: { flex: 1, fontSize: 24, fontWeight: '800', color: '#34d399' },
  row: { flexDirection: 'row' },
  typePill: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8,
    backgroundColor: '#111827', borderWidth: 1, borderColor: '#1e2d40',
  },
  typePillActive: { backgroundColor: 'rgba(201,168,76,0.15)', borderColor: '#C9A84C' },
  typePillText: { color: '#a8c4d8', fontSize: 14 },
  typePillTextActive: { color: '#C9A84C', fontWeight: '700' },
  saveBtn: {
    backgroundColor: '#C9A84C', borderRadius: 12, padding: 18,
    alignItems: 'center', marginTop: 24,
    shadowColor: '#C9A84C', shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#0a0f1a', fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  cancelBtn: { padding: 16, alignItems: 'center', marginTop: 8 },
  cancelBtnText: { color: '#7a9ab8', fontSize: 16 },
});
