import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/colors';

const REQUIRED_DOCS = [
  { key: 'insurance', label: 'Cargo Insurance', emoji: '🛡️', required: true, hint: 'Min. $100,000 cargo liability' },
  { key: 'license', label: "Driver's License", emoji: '🪪', required: true, hint: 'Front of valid commercial license' },
  { key: 'authority', label: 'Operating Authority', emoji: '📋', required: true, hint: 'MC/DOT certificate or CVOR' },
];

const OPTIONAL_DOCS = [
  { key: 'w9', label: 'W-9 Form', emoji: '📝', required: false, hint: 'Required for US carriers to receive payment' },
  { key: 'vehicle_title', label: 'Vehicle Registration', emoji: '🚛', required: false, hint: 'Transport vehicle registration' },
];

export default function DocumentsStep() {
  const [uploaded, setUploaded] = useState<Record<string, { name: string; url: string }>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const requiredDone = REQUIRED_DOCS.every(d => uploaded[d.key]);

  async function pickDocument(key: string, label: string) {
    Alert.alert(`Upload ${label}`, 'Choose a file or take a photo', [
      { text: 'Choose File (PDF)', onPress: () => pickFile(key, label) },
      { text: 'Take Photo', onPress: () => takePhoto(key, label) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function pickFile(key: string, label: string) {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    await upload(key, label, result.assets[0].uri, result.assets[0].name, result.assets[0].mimeType ?? 'application/pdf');
  }

  async function takePhoto(key: string, label: string) {
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    if (!granted) return;
    const result = await ImagePicker.launchCameraAsync({ quality: 0.85 });
    if (result.canceled) return;
    const uri = result.assets[0].uri;
    const name = `${key}_${Date.now()}.jpg`;
    await upload(key, label, uri, name, 'image/jpeg');
  }

  async function upload(key: string, label: string, uri: string, name: string, mimeType: string) {
    setUploading(key);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const ext = name.split('.').pop() ?? 'pdf';
      const fileName = `onboarding/${user?.id}/${key}_${Date.now()}.${ext}`;

      const response = await fetch(uri);
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from('carrier-docs')
        .upload(fileName, blob, { contentType: mimeType });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('carrier-docs').getPublicUrl(fileName);

      await supabase.from('carrier_insurance').insert({
        carrier_user_id: user?.id,
        document_type: key,
        document_url: publicUrl,
        status: 'pending',
      });

      setUploaded(prev => ({ ...prev, [key]: { name, url: publicUrl } }));
    } catch (err: any) {
      Alert.alert('Upload Failed', err.message);
    } finally {
      setUploading(null);
    }
  }

  async function handleSubmit() {
    if (!requiredDone) {
      return Alert.alert('Required Documents', 'Please upload all required documents before submitting.');
    }
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      // Mark carrier as pending review
      await supabase.from('carrier_users').update({ fmcsa_status: 'pending' }).eq('auth_user_id', user?.id);
      router.replace('/onboarding/complete');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.stepIndicator}>
        <StepDot num={1} done />
        <StepLine done />
        <StepDot num={2} done />
        <StepLine done />
        <StepDot num={3} done />
        <StepLine done />
        <StepDot num={4} active />
      </View>

      <Text style={styles.heading}>Documents</Text>
      <Text style={styles.sub}>Upload your compliance documents for verification</Text>

      <Text style={styles.sectionLabel}>REQUIRED</Text>
      {REQUIRED_DOCS.map(doc => (
        <DocRow
          key={doc.key}
          doc={doc}
          uploaded={uploaded[doc.key]}
          isUploading={uploading === doc.key}
          onPress={() => pickDocument(doc.key, doc.label)}
        />
      ))}

      <Text style={styles.sectionLabel}>OPTIONAL</Text>
      {OPTIONAL_DOCS.map(doc => (
        <DocRow
          key={doc.key}
          doc={doc}
          uploaded={uploaded[doc.key]}
          isUploading={uploading === doc.key}
          onPress={() => pickDocument(doc.key, doc.label)}
        />
      ))}

      <View style={styles.reviewNote}>
        <Text style={styles.reviewNoteText}>
          📋 Documents are reviewed within 24 hours. You can use the app while under review but won't be able to accept loads until verified.
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.btn, (!requiredDone || submitting) && styles.btnDisabled]}
        onPress={handleSubmit}
        disabled={!requiredDone || submitting}
      >
        {submitting
          ? <ActivityIndicator color={colors.white} />
          : <Text style={styles.btnText}>Submit for Review →</Text>
        }
      </TouchableOpacity>
    </ScrollView>
  );
}

function DocRow({ doc, uploaded, isUploading, onPress }: any) {
  return (
    <TouchableOpacity
      style={[styles.docRow, uploaded && styles.docRowDone]}
      onPress={onPress}
      disabled={isUploading}
    >
      <Text style={styles.docEmoji}>{doc.emoji}</Text>
      <View style={styles.docText}>
        <View style={styles.docLabelRow}>
          <Text style={styles.docLabel}>{doc.label}</Text>
          {doc.required && <Text style={styles.requiredTag}>Required</Text>}
        </View>
        <Text style={styles.docHint}>
          {uploaded ? `✅ ${uploaded.name}` : doc.hint}
        </Text>
      </View>
      {isUploading
        ? <ActivityIndicator color={colors.primary} size="small" />
        : <Text style={styles.docChevron}>{uploaded ? '✏️' : '+'}</Text>
      }
    </TouchableOpacity>
  );
}

function StepDot({ num, active, done }: { num: number; active?: boolean; done?: boolean }) {
  return (
    <View style={[styles.dot, active && styles.dotActive, done && styles.dotDone]}>
      <Text style={[styles.dotText, (active || done) && styles.dotTextActive]}>{done ? '✓' : num}</Text>
    </View>
  );
}
function StepLine({ done }: { done?: boolean }) {
  return <View style={[styles.stepLine, done && styles.stepLineDone]} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 24, gap: 10 },
  stepIndicator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  dot: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  dotActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  dotDone: { backgroundColor: colors.success, borderColor: colors.success },
  dotText: { color: colors.textMuted, fontWeight: '700', fontSize: 13 },
  dotTextActive: { color: colors.white },
  stepLine: { width: 32, height: 1, backgroundColor: colors.border },
  stepLineDone: { backgroundColor: colors.success },
  heading: { color: colors.text, fontSize: 26, fontWeight: '800' },
  sub: { color: colors.textMuted, fontSize: 15, marginBottom: 4 },
  sectionLabel: { color: colors.textDim, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginTop: 8 },
  docRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.bgCard, borderRadius: 12, borderWidth: 1,
    borderColor: colors.border, padding: 14,
  },
  docRowDone: { borderColor: colors.success + '66' },
  docEmoji: { fontSize: 28 },
  docText: { flex: 1, gap: 3 },
  docLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  docLabel: { color: colors.text, fontWeight: '700', fontSize: 14 },
  requiredTag: {
    backgroundColor: colors.danger + '22', borderWidth: 1, borderColor: colors.danger + '44',
    borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1,
    color: colors.danger, fontSize: 10, fontWeight: '700',
  },
  docHint: { color: colors.textMuted, fontSize: 12 },
  docChevron: { color: colors.textDim, fontSize: 20 },
  reviewNote: {
    backgroundColor: colors.primary + '15', borderRadius: 10, borderWidth: 1,
    borderColor: colors.primary + '33', padding: 14,
  },
  reviewNoteText: { color: colors.textMuted, fontSize: 13, lineHeight: 20 },
  btn: {
    backgroundColor: colors.primary, borderRadius: 12,
    padding: 16, alignItems: 'center', marginTop: 8,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: colors.white, fontSize: 17, fontWeight: '800' },
});
