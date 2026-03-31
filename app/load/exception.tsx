import { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/colors';

const EXCEPTION_TYPES = [
  { key: 'damage', label: '💥 Vehicle Damage' },
  { key: 'delay', label: '⏱️ Delay' },
  { key: 'access_issue', label: '🚫 Access Issue' },
  { key: 'weather', label: '🌧️ Weather / Road Conditions' },
  { key: 'mechanical', label: '🔧 Mechanical Problem' },
  { key: 'refused', label: '❌ Delivery Refused' },
  { key: 'other', label: '📝 Other' },
];

const SEVERITIES = [
  { key: 'low', label: 'Low', color: colors.success },
  { key: 'medium', label: 'Medium', color: colors.warning },
  { key: 'high', label: 'High', color: colors.danger },
];

export default function ExceptionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [type, setType] = useState('');
  const [severity, setSeverity] = useState('medium');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  async function addPhoto() {
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled) {
      setPhotos((prev) => [...prev, result.assets[0].uri]);
    }
  }

  async function submit() {
    if (!type) return Alert.alert('Required', 'Please select an exception type.');
    if (!description.trim()) return Alert.alert('Required', 'Please describe the exception.');

    setSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const uploadedUrls: string[] = [];

      for (const uri of photos) {
        const ext = uri.split('.').pop() ?? 'jpg';
        const fileName = `${id}/exception_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const response = await fetch(uri);
        const blob = await response.blob();
        const { error } = await supabase.storage
          .from('carrier-pod')
          .upload(fileName, blob, { contentType: `image/${ext}` });
        if (!error) {
          const { data: { publicUrl } } = supabase.storage.from('carrier-pod').getPublicUrl(fileName);
          uploadedUrls.push(publicUrl);
        }
      }

      const { error } = await supabase.from('carrier_exceptions').insert({
        shipment_id: id,
        carrier_user_id: user?.id,
        exception_type: type,
        severity,
        description: description.trim(),
        photo_urls: uploadedUrls,
        resolved: false,
      });

      if (error) throw error;

      Alert.alert('✅ Submitted', 'Exception reported successfully.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to submit exception');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      <Text style={styles.sectionTitle}>Exception Type</Text>
      <View style={styles.optionGrid}>
        {EXCEPTION_TYPES.map((et) => (
          <TouchableOpacity
            key={et.key}
            style={[styles.option, type === et.key && styles.optionSelected]}
            onPress={() => setType(et.key)}
          >
            <Text style={[styles.optionText, type === et.key && styles.optionTextSelected]}>
              {et.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Severity</Text>
      <View style={styles.severityRow}>
        {SEVERITIES.map((s) => (
          <TouchableOpacity
            key={s.key}
            style={[
              styles.severityBtn,
              severity === s.key && { backgroundColor: s.color, borderColor: s.color },
            ]}
            onPress={() => setSeverity(s.key)}
          >
            <Text style={[
              styles.severityText,
              severity === s.key && { color: colors.white },
            ]}>
              {s.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Description</Text>
      <TextInput
        style={styles.textArea}
        value={description}
        onChangeText={setDescription}
        placeholder="Describe the exception in detail..."
        placeholderTextColor={colors.textDim}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
      />

      <Text style={styles.sectionTitle}>Photos ({photos.length})</Text>
      <TouchableOpacity style={styles.photoBtn} onPress={addPhoto}>
        <Text style={styles.photoBtnText}>📷 Add Photo</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.submitBtn, submitting && styles.btnDisabled]}
        onPress={submit}
        disabled={submitting}
      >
        {submitting
          ? <ActivityIndicator color={colors.white} />
          : <Text style={styles.submitText}>Submit Exception Report</Text>
        }
      </TouchableOpacity>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 12 },
  sectionTitle: { color: colors.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  optionGrid: { gap: 8 },
  option: {
    backgroundColor: colors.bgCard,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.primary + '22' },
  optionText: { color: colors.textMuted, fontSize: 14 },
  optionTextSelected: { color: colors.primary, fontWeight: '700' },
  severityRow: { flexDirection: 'row', gap: 8 },
  severityBtn: {
    flex: 1, borderRadius: 8, borderWidth: 1,
    borderColor: colors.border, padding: 10, alignItems: 'center',
  },
  severityText: { color: colors.textMuted, fontWeight: '600', fontSize: 14 },
  textArea: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 14,
    color: colors.text,
    fontSize: 15,
    minHeight: 100,
  },
  photoBtn: {
    backgroundColor: colors.bgCard,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    padding: 16,
    alignItems: 'center',
  },
  photoBtnText: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  submitBtn: {
    backgroundColor: colors.danger,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  submitText: { color: colors.white, fontWeight: '800', fontSize: 16 },
});
