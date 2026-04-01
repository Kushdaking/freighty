import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, FlatList,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/colors';

const DASHBOARD_URL = 'https://app.prevaylos.com';

export default function FileClaimScreen() {
  const { shipmentId } = useLocalSearchParams<{ shipmentId?: string }>();
  const [carrierId, setCarrierId] = useState<string | null>(null);
  const [shipments, setShipments] = useState<any[]>([]);
  const [selectedShipment, setSelectedShipment] = useState<any | null>(null);
  const [claims, setClaims] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<'list' | 'file'>('list');

  const [description, setDescription] = useState('');
  const [claimedAmount, setClaimedAmount] = useState('');

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: carrier } = await supabase.from('carrier_users').select('id').eq('auth_user_id', user.id).single();
    if (!carrier) { setLoading(false); return; }
    setCarrierId(carrier.id);

    const [{ data: sdata }, { data: cdata }] = await Promise.all([
      supabase.from('shipments').select('id, tracking_number, origin_state, destination_state, status, carrier_pod_uploaded')
        .eq('carrier_user_id', carrier.id).eq('status', 'delivered').order('created_at', { ascending: false }).limit(20),
      supabase.from('damage_claims').select('*').eq('carrier_user_id', carrier.id).order('created_at', { ascending: false }),
    ]);

    setShipments(sdata ?? []);
    setClaims(cdata ?? []);

    if (shipmentId) {
      const found = sdata?.find(s => s.id === shipmentId);
      if (found) { setSelectedShipment(found); setMode('file'); }
    }
    setLoading(false);
  }

  async function submitClaim() {
    if (!selectedShipment || !description) {
      Alert.alert('Missing Info', 'Please select a shipment and describe the damage.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${DASHBOARD_URL}/api/claims`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shipment_id: selectedShipment.id,
          carrier_user_id: carrierId,
          damage_description: description,
          claimed_amount: parseFloat(claimedAmount) || null,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      Alert.alert('Claim Filed', `Your claim #${data.claim_number} has been submitted. A dispatcher will review it.`);
      setMode('list');
      setDescription('');
      setClaimedAmount('');
      setSelectedShipment(null);
      loadData();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSubmitting(false);
    }
  }

  const STATUS_COLOR: Record<string, string> = {
    open: '#ef4444', reviewing: '#f59e0b', approved: '#10b981', denied: '#6b7280', settled: '#818cf8',
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Damage Claims</Text>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, mode === 'list' && styles.tabActive]} onPress={() => setMode('list')}>
          <Text style={[styles.tabText, mode === 'list' && styles.tabTextActive]}>My Claims</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, mode === 'file' && styles.tabActive]} onPress={() => setMode('file')}>
          <Text style={[styles.tabText, mode === 'file' && styles.tabTextActive]}>File New Claim</Text>
        </TouchableOpacity>
      </View>

      {mode === 'list' && (
        <View>
          {claims.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🛡️</Text>
              <Text style={styles.emptyText}>No claims filed</Text>
              <Text style={styles.emptySub}>File a claim for a delivered load with damage.</Text>
            </View>
          ) : (
            claims.map(claim => (
              <View key={claim.id} style={styles.claimCard}>
                <View style={styles.claimHeader}>
                  <Text style={styles.claimNumber}>{claim.claim_number}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: `${STATUS_COLOR[claim.status]}22` }]}>
                    <Text style={[styles.statusText, { color: STATUS_COLOR[claim.status] || colors.text }]}>
                      {claim.status.charAt(0).toUpperCase() + claim.status.slice(1)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.claimDesc} numberOfLines={2}>{claim.damage_description}</Text>
                <View style={styles.claimFooter}>
                  {claim.claimed_amount && <Text style={styles.claimAmt}>Claimed: ${claim.claimed_amount.toLocaleString()}</Text>}
                  {claim.approved_amount && <Text style={styles.approvedAmt}>Approved: ${claim.approved_amount.toLocaleString()}</Text>}
                </View>
                <Text style={styles.claimDate}>{new Date(claim.created_at).toLocaleDateString()}</Text>
              </View>
            ))
          )}
        </View>
      )}

      {mode === 'file' && (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>SELECT SHIPMENT</Text>
          {shipments.length === 0 ? (
            <Text style={styles.empty2}>No delivered loads available for claims.</Text>
          ) : (
            shipments.map(s => (
              <TouchableOpacity key={s.id} style={[styles.shipmentRow, selectedShipment?.id === s.id && styles.shipmentRowActive]}
                onPress={() => setSelectedShipment(s)}>
                <Text style={styles.shipmentTrack}>{s.tracking_number}</Text>
                <Text style={styles.shipmentRoute}>{s.origin_state} → {s.destination_state}</Text>
                {selectedShipment?.id === s.id && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
            ))
          )}

          <Text style={[styles.sectionLabel, { marginTop: 12 }]}>DAMAGE DESCRIPTION *</Text>
          <TextInput style={[styles.input, { height: 100 }]} value={description} onChangeText={setDescription}
            placeholder="Describe the damage in detail: location, severity, estimated cause..."
            placeholderTextColor={colors.textMuted} multiline />

          <Text style={styles.sectionLabel}>CLAIMED AMOUNT ($)</Text>
          <TextInput style={styles.input} value={claimedAmount} onChangeText={setClaimedAmount}
            placeholder="e.g. 1500.00" placeholderTextColor={colors.textMuted} keyboardType="numeric" />

          <TouchableOpacity style={[styles.btn, submitting && { opacity: 0.6 }]} onPress={submitClaim} disabled={submitting}>
            {submitting ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.btnText}>📋 Submit Claim</Text>}
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  tabs: { flexDirection: 'row', borderWidth: 1, borderColor: colors.border, borderRadius: 10, overflow: 'hidden' },
  tab: { flex: 1, padding: 12, alignItems: 'center', backgroundColor: colors.bg },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: '#2E4057' },
  card: { backgroundColor: colors.bgCard, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border, gap: 10 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 1 },
  input: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, color: colors.text, fontSize: 14 },
  btn: { backgroundColor: colors.primary, borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 4 },
  btnText: { color: '#2E4057', fontWeight: '800', fontSize: 15 },
  empty: { alignItems: 'center', padding: 40, gap: 8 },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 18, fontWeight: '700', color: colors.text },
  emptySub: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  empty2: { color: colors.textMuted, fontSize: 13, textAlign: 'center', padding: 20 },
  shipmentRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg, gap: 10 },
  shipmentRowActive: { borderColor: colors.primary, backgroundColor: `${colors.primary}22` },
  shipmentTrack: { fontFamily: 'monospace', fontSize: 13, color: colors.primary, fontWeight: '700' },
  shipmentRoute: { flex: 1, fontSize: 13, color: colors.text },
  checkmark: { color: colors.primary, fontWeight: '700', fontSize: 16 },
  claimCard: { backgroundColor: colors.bgCard, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 10 },
  claimHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  claimNumber: { fontFamily: 'monospace', fontSize: 13, color: colors.primary, fontWeight: '700' },
  statusBadge: { borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2 },
  statusText: { fontSize: 12, fontWeight: '700' },
  claimDesc: { fontSize: 13, color: colors.textMuted, lineHeight: 18, marginBottom: 8 },
  claimFooter: { flexDirection: 'row', gap: 16 },
  claimAmt: { fontSize: 13, color: colors.text, fontWeight: '600' },
  approvedAmt: { fontSize: 13, color: '#10b981', fontWeight: '700' },
  claimDate: { fontSize: 11, color: colors.textMuted, marginTop: 6 },
});
