import { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/colors';

const DOC_TYPES = [
  { key: 'bill_of_lading', label: 'Bill of Lading (BOL)', emoji: '📋' },
  { key: 'inspection_report', label: 'Vehicle Inspection Report', emoji: '🔍' },
  { key: 'customs', label: 'Customs / Border Docs', emoji: '🛃' },
  { key: 'insurance', label: 'Insurance Certificate', emoji: '🛡️' },
  { key: 'other', label: 'Other Document', emoji: '📎' },
];

export default function DocumentsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<Set<string>>(new Set());

  async function pickAndUpload(docType: string) {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
    });

    if (result.canceled) return;

    const file = result.assets[0];
    setUploading(docType);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const ext = file.name.split('.').pop() ?? 'pdf';
      const fileName = `${id}/${docType}_${Date.now()}.${ext}`;

      const response = await fetch(file.uri);
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from('carrier-docs')
        .upload(fileName, blob, { contentType: file.mimeType ?? 'application/octet-stream' });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('carrier-docs')
        .getPublicUrl(fileName);

      await supabase.from('vehicle_documents').insert({
        shipment_id: id,
        org_id: null,
        document_type: docType,
        document_name: file.name,
        file_url: publicUrl,
        uploaded_by: user?.id,
        status: 'pending',
        uploaded_at: new Date().toISOString(),
      });

      setUploaded((prev) => new Set([...prev, docType]));
      Alert.alert('✅ Uploaded', `${file.name} saved successfully.`);
    } catch (err: any) {
      Alert.alert('Upload Failed', err.message ?? 'Unknown error');
    } finally {
      setUploading(null);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.intro}>
        Upload required documents for this shipment. PDFs and images accepted.
      </Text>

      {DOC_TYPES.map((dt) => {
        const done = uploaded.has(dt.key);
        const isUploading = uploading === dt.key;
        return (
          <TouchableOpacity
            key={dt.key}
            style={[styles.row, done && styles.rowDone]}
            onPress={() => pickAndUpload(dt.key)}
            disabled={isUploading}
          >
            <Text style={styles.rowEmoji}>{dt.emoji}</Text>
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>{dt.label}</Text>
              <Text style={styles.rowSub}>{done ? '✅ Uploaded' : 'Tap to upload'}</Text>
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
