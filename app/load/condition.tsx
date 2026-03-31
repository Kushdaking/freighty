import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, TextInput, FlatList,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'react-native';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/colors';
import { CarOutline } from '@/components/CarOutline';

type PhotoSlot = {
  key: string;
  label: string;
  view: 'front' | 'rear' | 'driver' | 'passenger' | 'front-quarter' | 'rear-quarter';
  instruction: string;
};

const PICKUP_SLOTS: PhotoSlot[] = [
  { key: 'pickup_front', label: 'Front', view: 'front', instruction: 'Stand directly in front of the vehicle, capture full front bumper to roof' },
  { key: 'pickup_rear', label: 'Rear', view: 'rear', instruction: 'Stand directly behind the vehicle, capture full rear bumper to roof' },
  { key: 'pickup_driver', label: 'Driver Side', view: 'driver', instruction: 'Stand on the driver side, capture full length of vehicle' },
  { key: 'pickup_passenger', label: 'Passenger Side', view: 'passenger', instruction: 'Stand on the passenger side, capture full length of vehicle' },
  { key: 'pickup_front_quarter', label: 'Front 3/4', view: 'front-quarter', instruction: 'Stand at the front-driver corner at 45°, capture front and driver side' },
  { key: 'pickup_rear_quarter', label: 'Rear 3/4', view: 'rear-quarter', instruction: 'Stand at the rear-passenger corner at 45°, capture rear and passenger side' },
];

const DELIVERY_SLOTS: PhotoSlot[] = [
  { key: 'delivery_front', label: 'Front', view: 'front', instruction: 'Stand directly in front of the vehicle, capture full front bumper to roof' },
  { key: 'delivery_rear', label: 'Rear', view: 'rear', instruction: 'Stand directly behind the vehicle, capture full rear bumper to roof' },
  { key: 'delivery_driver', label: 'Driver Side', view: 'driver', instruction: 'Stand on the driver side, capture full length of vehicle' },
  { key: 'delivery_passenger', label: 'Passenger Side', view: 'passenger', instruction: 'Stand on the passenger side, capture full length of vehicle' },
  { key: 'delivery_front_quarter', label: 'Front 3/4', view: 'front-quarter', instruction: 'Stand at the front-driver corner at 45°, capture front and driver side' },
  { key: 'delivery_rear_quarter', label: 'Rear 3/4', view: 'rear-quarter', instruction: 'Stand at the rear-passenger corner at 45°, capture rear and passenger side' },
];

type PhotoData = {
  uri: string;
  url?: string;
  notes: string;
  uploaded: boolean;
};

export default function ConditionReportScreen() {
  const { id, vehicleId, stage } = useLocalSearchParams<{ id: string; vehicleId: string; stage: string }>();
  const isPickup = stage !== 'delivery';
  const slots = isPickup ? PICKUP_SLOTS : DELIVERY_SLOTS;
  const title = isPickup ? 'Pickup Condition' : 'Delivery Condition';

  const [photos, setPhotos] = useState<Record<string, PhotoData>>({});
  const [activeSlot, setActiveSlot] = useState<PhotoSlot | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const completedCount = Object.keys(photos).filter(k => photos[k]?.uploaded).length;
  const allDone = completedCount === slots.length;

  async function openCamera(slot: PhotoSlot) {
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    if (!granted) {
      Alert.alert('Permission Required', 'Camera access is needed to take photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.85,
      allowsEditing: false,
    });

    if (result.canceled) return;

    const uri = result.assets[0].uri;
    setActiveSlot(null);
    await uploadPhoto(slot, uri);
  }

  async function uploadPhoto(slot: PhotoSlot, uri: string) {
    setUploading(slot.key);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const ext = uri.split('.').pop() ?? 'jpg';
      const fileName = `${id}/${vehicleId ?? 'vehicle'}/${slot.key}_${Date.now()}.${ext}`;

      const response = await fetch(uri);
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from('carrier-pod')
        .upload(fileName, blob, { contentType: `image/${ext}` });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('carrier-pod')
        .getPublicUrl(fileName);

      // Save to carrier_pod table
      await supabase.from('carrier_pod').insert({
        shipment_id: id,
        vehicle_id: vehicleId ?? null,
        carrier_user_id: user?.id,
        photo_type: slot.key,
        photo_url: publicUrl,
        caption: slot.label,
        taken_at: new Date().toISOString(),
      });

      setPhotos(prev => ({
        ...prev,
        [slot.key]: { uri, url: publicUrl, notes: prev[slot.key]?.notes ?? '', uploaded: true },
      }));
    } catch (err: any) {
      Alert.alert('Upload Failed', err.message ?? 'Unknown error');
    } finally {
      setUploading(null);
    }
  }

  async function submitReport() {
    if (!allDone) {
      Alert.alert('Incomplete', `Please capture all 6 photos before submitting. (${completedCount}/6 done)`);
      return;
    }

    setSubmitting(true);
    try {
      // Log a shipment event
      await supabase.from('shipment_events').insert({
        shipment_id: id,
        event_type: isPickup ? 'pickup_inspection' : 'delivery_inspection',
        description: `${title} inspection completed — 6 photos captured`,
        event_time: new Date().toISOString(),
      });

      Alert.alert('✅ Report Submitted', `${title} condition report saved.`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // Show camera guide overlay for active slot
  if (activeSlot) {
    return (
      <View style={styles.guideContainer}>
        <Stack.Screen options={{ title: activeSlot.label, headerShown: true }} />
        <View style={styles.guideContent}>
          <Text style={styles.guideTitle}>{activeSlot.label} View</Text>
          <Text style={styles.guideInstruction}>{activeSlot.instruction}</Text>

          <View style={styles.carOutlineContainer}>
            <CarOutline
              view={activeSlot.view}
              size={180}
              color="#475569"
              highlightColor="#2563eb"
            />
          </View>

          <Text style={styles.guideHint}>Position yourself as shown above</Text>

          <TouchableOpacity
            style={styles.cameraBtn}
            onPress={() => openCamera(activeSlot)}
          >
            <Text style={styles.cameraBtnText}>📷  Take Photo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => setActiveSlot(null)}
          >
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>

        {/* Progress */}
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${(completedCount / slots.length) * 100}%` }]} />
        </View>
        <Text style={styles.progressText}>{completedCount} of {slots.length} photos complete</Text>

        <Text style={styles.intro}>
          Tap each angle to see the camera guide and take the required photo.
        </Text>

        {/* Photo grid */}
        <View style={styles.grid}>
          {slots.map((slot) => {
            const photo = photos[slot.key];
            const isUploading = uploading === slot.key;
            const done = photo?.uploaded;

            return (
              <TouchableOpacity
                key={slot.key}
                style={[styles.slot, done && styles.slotDone]}
                onPress={() => setActiveSlot(slot)}
                disabled={isUploading}
                activeOpacity={0.7}
              >
                {isUploading ? (
                  <ActivityIndicator color={colors.primary} size="large" />
                ) : done && photo?.uri ? (
                  <>
                    <Image source={{ uri: photo.uri }} style={styles.slotImage} />
                    <View style={styles.slotCheck}>
                      <Text style={styles.slotCheckText}>✅</Text>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.slotOutline}>
                      <CarOutline view={slot.view} size={70} color="#475569" highlightColor="#3b82f6" />
                    </View>
                    <Text style={styles.slotLabel}>{slot.label}</Text>
                    <Text style={styles.slotTap}>Tap to capture</Text>
                  </>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, !allDone && styles.submitBtnDisabled, submitting && styles.submitBtnDisabled]}
          onPress={submitReport}
          disabled={!allDone || submitting}
        >
          {submitting
            ? <ActivityIndicator color={colors.white} />
            : <Text style={styles.submitText}>
                {allDone ? `Submit ${title} Report` : `${completedCount}/6 Photos Required`}
              </Text>
          }
        </TouchableOpacity>

      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 14 },
  progressBar: {
    height: 6, backgroundColor: colors.bgCardAlt, borderRadius: 3, overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 3 },
  progressText: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
  intro: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  grid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between',
  },
  slot: {
    width: '48%',
    aspectRatio: 1,
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
    gap: 4,
    overflow: 'hidden',
  },
  slotDone: { borderColor: colors.success + '88' },
  slotOutline: { justifyContent: 'center', alignItems: 'center' },
  slotImage: { width: '100%', height: '100%', borderRadius: 10, position: 'absolute' },
  slotCheck: {
    position: 'absolute', top: 6, right: 6,
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 12, padding: 2,
  },
  slotCheckText: { fontSize: 16 },
  slotLabel: { color: colors.text, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  slotTap: { color: colors.textDim, fontSize: 11 },
  submitBtn: {
    backgroundColor: colors.primary, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8,
  },
  submitBtnDisabled: { backgroundColor: colors.textDim },
  submitText: { color: colors.white, fontWeight: '800', fontSize: 16 },

  // Guide overlay
  guideContainer: { flex: 1, backgroundColor: colors.bg },
  guideContent: {
    flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 16,
  },
  guideTitle: { color: colors.text, fontSize: 24, fontWeight: '800' },
  guideInstruction: {
    color: colors.textMuted, fontSize: 15, textAlign: 'center', lineHeight: 22,
  },
  carOutlineContainer: {
    backgroundColor: colors.bgCard,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  guideHint: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  cameraBtn: {
    backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 16,
    paddingHorizontal: 48, width: '100%', alignItems: 'center',
  },
  cameraBtnText: { color: colors.white, fontSize: 18, fontWeight: '800' },
  cancelBtn: { padding: 12 },
  cancelBtnText: { color: colors.textMuted, fontSize: 15 },
});
