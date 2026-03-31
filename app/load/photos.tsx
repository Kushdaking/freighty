import { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Image, ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/colors';

type PhotoType = 'pickup_front' | 'pickup_rear' | 'pickup_left' | 'pickup_right' | 'pickup_vin' | 'delivery_front' | 'delivery_rear' | 'delivery_left' | 'delivery_right' | 'delivery_signed';

const PHOTO_TYPES: { key: PhotoType; label: string; emoji: string }[] = [
  { key: 'pickup_front', label: 'Pickup - Front', emoji: '⬆️' },
  { key: 'pickup_rear', label: 'Pickup - Rear', emoji: '⬇️' },
  { key: 'pickup_left', label: 'Pickup - Left Side', emoji: '⬅️' },
  { key: 'pickup_right', label: 'Pickup - Right Side', emoji: '➡️' },
  { key: 'pickup_vin', label: 'Pickup - VIN Plate', emoji: '🔢' },
  { key: 'delivery_front', label: 'Delivery - Front', emoji: '⬆️' },
  { key: 'delivery_rear', label: 'Delivery - Rear', emoji: '⬇️' },
  { key: 'delivery_left', label: 'Delivery - Left Side', emoji: '⬅️' },
  { key: 'delivery_right', label: 'Delivery - Right Side', emoji: '➡️' },
  { key: 'delivery_signed', label: 'Signed BOL', emoji: '✍️' },
];

export default function PhotosScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<Set<string>>(new Set());

  async function pickAndUpload(photoType: PhotoType) {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission Required', 'Camera access is needed to take photos.');
      return;
    }

    Alert.alert('Add Photo', 'How would you like to add this photo?', [
      { text: 'Take Photo', onPress: () => capturePhoto(photoType, 'camera') },
      { text: 'Choose from Library', onPress: () => capturePhoto(photoType, 'library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function capturePhoto(photoType: PhotoType, source: 'camera' | 'library') {
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ quality: 0.8, base64: false })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.8, base64: false });

    if (result.canceled) return;

    const asset = result.assets[0];
    setUploading(photoType);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const ext = asset.uri.split('.').pop() ?? 'jpg';
      const fileName = `${id}/${photoType}_${Date.now()}.${ext}`;

      const response = await fetch(asset.uri);
      const blob = await response.blob();

      const { error: uploadError, data } = await supabase.storage
        .from('carrier-pod')
        .upload(fileName, blob, { contentType: `image/${ext}` });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('carrier-pod')
        .getPublicUrl(fileName);

      await supabase.from('carrier_pod').insert({
        shipment_id: id,
        carrier_user_id: user?.id,
        photo_type: photoType,
        photo_url: publicUrl,
        taken_at: new Date().toISOString(),
      });

      setUploaded((prev) => new Set([...prev, photoType]));
      Alert.alert('✅ Uploaded', 'Photo saved successfully.');
    } catch (err: any) {
      Alert.alert('Upload Failed', err.message ?? 'Unknown error');
    } finally {
      setUploading(null);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.intro}>
        Take or upload photos for pickup condition and delivery proof of delivery (POD).
      </Text>

      {PHOTO_TYPES.map((pt) => {
        const done = uploaded.has(pt.key);
        const isUploading = uploading === pt.key;
        return (
          <TouchableOpacity
            key={pt.key}
            style={[styles.row, done && styles.rowDone]}
            onPress={() => pickAndUpload(pt.key)}
            disabled={isUploading}
          >
            <Text style={styles.rowEmoji}>{pt.emoji}</Text>
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>{pt.label}</Text>
              <Text style={styles.rowSub}>{done ? '✅ Uploaded' : 'Tap to add photo'}</Text>
            </View>
            {isUploading
              ? <ActivityIndicator color={colors.primary} />
              : <Text style={styles.chevron}>›</Text>
            }
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 10 },
  intro: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginBottom: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 12,
  },
  rowDone: { borderColor: colors.success + '66' },
  rowEmoji: { fontSize: 22 },
  rowText: { flex: 1 },
  rowLabel: { color: colors.text, fontSize: 14, fontWeight: '600' },
  rowSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  chevron: { color: colors.textDim, fontSize: 22 },
});
