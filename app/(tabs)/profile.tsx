import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, ScrollView, TextInput, Modal,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/colors';
import type { CarrierUser } from '@/lib/types';

export default function ProfileScreen() {
  const [carrier, setCarrier] = useState<CarrierUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [eldConnected, setEldConnected] = useState(false);
  const [showEldModal, setShowEldModal] = useState(false);
  const [eldApiKey, setEldApiKey] = useState('');
  const [eldPlatform, setEldPlatform] = useState('samsara');
  const [eldSaving, setEldSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('carrier_users')
        .select('*')
        .eq('auth_user_id', user.id)
        .single();

      setCarrier(data);

      if (data?.id) {
        const { data: creds } = await supabase
          .from('marketplace_credentials')
          .select('platform, is_active')
          .eq('carrier_user_id', data.id)
          .eq('is_active', true)
          .limit(1);
        setEldConnected(!!(creds && creds.length > 0));
      }

      setLoading(false);
    }
    load();
  }, []);

  async function connectELD() {
    if (!eldApiKey.trim()) {
      Alert.alert('Required', 'Please enter your API key');
      return;
    }
    setEldSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !carrier) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('marketplace_credentials')
        .upsert({
          carrier_user_id: carrier.id,
          platform: eldPlatform,
          api_key: eldApiKey.trim(),
          is_active: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'carrier_user_id,platform' });

      if (error) throw error;

      setEldConnected(true);
      setShowEldModal(false);
      setEldApiKey('');
      Alert.alert('Connected!', `${eldPlatform.charAt(0).toUpperCase() + eldPlatform.slice(1)} ELD connected successfully. Your hours of service and location will sync to dispatch.`);
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to connect ELD');
    } finally {
      setEldSaving(false);
    }
  }

  async function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {carrier?.name?.charAt(0).toUpperCase() ?? '?'}
        </Text>
      </View>

      <Text style={styles.name}>{carrier?.name ?? 'Unknown Carrier'}</Text>
      <Text style={styles.email}>{carrier?.email}</Text>

      {carrier?.is_verified && (
        <View style={styles.verifiedBadge}>
          <Text style={styles.verifiedText}>✅ Verified Carrier</Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Company</Text>
        <InfoRow label="Company" value={carrier?.company_name} />
        <InfoRow label="Phone" value={carrier?.phone} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Credentials</Text>
        <InfoRow label="MC Number" value={carrier?.mc_number} />
        <InfoRow label="DOT Number" value={carrier?.dot_number} />
        <InfoRow label="FMCSA Status" value={carrier?.fmcsa_status?.toUpperCase()} />
      </View>

      {/* ELD Integration */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ELD Integration</Text>
        <InfoRow label="Status" value={eldConnected ? '✅ Connected' : '⚪ Not Connected'} />
        {(carrier as any)?.eld_platform && (
          <InfoRow label="Platform" value={(carrier as any).eld_platform} />
        )}
        {(carrier as any)?.eld_hours_available !== undefined && (
          <InfoRow label="Hours Available" value={`${(carrier as any).eld_hours_available}h today`} />
        )}
        <TouchableOpacity
          style={[styles.eldBtn, eldConnected && styles.eldBtnConnected]}
          onPress={() => setShowEldModal(true)}
        >
          <Text style={styles.eldBtnText}>
            {eldConnected ? '🔌 Reconnect ELD' : '🔌 Connect ELD'}
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>

      {/* ELD Connect Modal */}
      <Modal visible={showEldModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowEldModal(false)}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>🔌 Connect ELD</Text>
          <Text style={styles.modalSub}>
            Connect your Electronic Logging Device to share Hours of Service and location with dispatchers.
          </Text>

          <Text style={styles.fieldLabel}>ELD Provider</Text>
          <View style={styles.platformPicker}>
            {['samsara', 'keeptruckin', 'geotab'].map(p => (
              <TouchableOpacity
                key={p}
                style={[styles.platformBtn, eldPlatform === p && styles.platformBtnActive]}
                onPress={() => setEldPlatform(p)}
              >
                <Text style={[styles.platformText, eldPlatform === p && styles.platformTextActive]}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fieldLabel}>API Key</Text>
          <TextInput
            style={styles.apiInput}
            value={eldApiKey}
            onChangeText={setEldApiKey}
            placeholder="Paste your API key here"
            placeholderTextColor={colors.textDim}
            secureTextEntry
            autoCapitalize="none"
          />
          <Text style={styles.apiHint}>
            Find your API key in your {eldPlatform} dashboard → Settings → Developer → API Keys
          </Text>

          <TouchableOpacity
            style={[styles.connectBtn, eldSaving && { opacity: 0.6 }]}
            onPress={connectELD}
            disabled={eldSaving}
          >
            <Text style={styles.connectBtnText}>{eldSaving ? 'Connecting...' : 'Connect'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ alignItems: 'center', padding: 16 }} onPress={() => setShowEldModal(false)}>
            <Text style={{ color: colors.textMuted, fontSize: 14 }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value ?? '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 24, alignItems: 'center', gap: 12 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 4,
  },
  avatarText: { color: colors.white, fontSize: 36, fontWeight: '800' },
  name: { color: colors.text, fontSize: 22, fontWeight: '800' },
  email: { color: colors.textMuted, fontSize: 14 },
  verifiedBadge: {
    backgroundColor: colors.success + '22',
    borderWidth: 1,
    borderColor: colors.success,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  verifiedText: { color: colors.success, fontWeight: '600', fontSize: 13 },
  section: {
    width: '100%',
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
  },
  sectionTitle: { color: colors.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between' },
  infoLabel: { color: colors.textMuted, fontSize: 14 },
  infoValue: { color: colors.text, fontSize: 14, fontWeight: '600' },
  signOutBtn: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  signOutText: { color: colors.danger, fontWeight: '700', fontSize: 15 },
  eldBtn: {
    backgroundColor: colors.primary + '22',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  eldBtnConnected: {
    backgroundColor: colors.success + '11',
    borderColor: colors.success,
  },
  eldBtnText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: 24,
    gap: 12,
  },
  modalTitle: { color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: 4 },
  modalSub: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  fieldLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginTop: 8 },
  platformPicker: { flexDirection: 'row', gap: 8 },
  platformBtn: {
    flex: 1, padding: 10, borderRadius: 8,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center',
  },
  platformBtnActive: { backgroundColor: colors.primary + '22', borderColor: colors.primary },
  platformText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  platformTextActive: { color: colors.primary },
  apiInput: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 14,
    color: colors.text,
    fontSize: 14,
    fontFamily: 'monospace',
  },
  apiHint: { color: colors.textDim, fontSize: 12, lineHeight: 18 },
  connectBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  connectBtnText: { color: colors.white, fontWeight: '800', fontSize: 16 },
});
