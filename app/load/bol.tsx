import { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Modal,
} from 'react-native';
import { useLocalSearchParams, router, Stack, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import SignatureCanvas from 'react-native-signature-canvas';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/colors';
import type { Shipment, Vehicle } from '@/lib/types';

type Stage = 'pickup' | 'delivery';
type DamageArea = 'front' | 'rear' | 'driver' | 'passenger' | 'roof' | 'hood' | 'trunk';

const DAMAGE_AREAS: { key: DamageArea; label: string; emoji: string }[] = [
  { key: 'front', label: 'Front', emoji: '⬆️' },
  { key: 'rear', label: 'Rear', emoji: '⬇️' },
  { key: 'driver', label: 'Driver Side', emoji: '⬅️' },
  { key: 'passenger', label: 'Passenger Side', emoji: '➡️' },
  { key: 'roof', label: 'Roof', emoji: '⬛' },
  { key: 'hood', label: 'Hood', emoji: '🔲' },
  { key: 'trunk', label: 'Trunk', emoji: '🔳' },
];

const DAMAGE_TYPES = ['Scratch', 'Dent', 'Crack', 'Chip', 'Missing Part', 'Rust', 'Other'];

const CONDITIONS = [
  { key: 'excellent', label: 'Excellent', color: colors.success },
  { key: 'good', label: 'Good', color: '#16a34a' },
  { key: 'fair', label: 'Fair', color: colors.warning },
  { key: 'poor', label: 'Poor', color: colors.danger },
];

interface VehicleBOL {
  vehicleId: string;
  vin: string;
  vinConfirmed: boolean;
  vinMismatch: string;
  condition: string;
  damages: { area: DamageArea; type: string; notes: string }[];
  isOperable: boolean;
  odometer: string;
  notes: string;
}

export default function BOLScreen() {
  const { id, stage, scannedVin, scannedVehicleIdx } = useLocalSearchParams<{
    id: string; stage: string; scannedVin?: string; scannedVehicleIdx?: string;
  }>();
  const isPickup = stage !== 'delivery';
  const title = isPickup ? 'Pickup BOL' : 'Delivery BOL';

  const [load, setLoad] = useState<Shipment | null>(null);
  const [vehicles, setVehicles] = useState<VehicleBOL[]>([]);
  const [step, setStep] = useState<'vehicles' | 'damages' | 'signature' | 'customer_sig' | 'complete'>('vehicles');
  const [currentVehicleIdx, setCurrentVehicleIdx] = useState(0);
  const [carrierSig, setCarrierSig] = useState<string | null>(null);
  const [customerSig, setCustomerSig] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [showSigModal, setShowSigModal] = useState(false);
  const [sigTarget, setSigTarget] = useState<'carrier' | 'customer'>('carrier');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const sigRef = useRef<any>(null);

  // Handle returned VIN from scanner
  useFocusEffect(
    useCallback(() => {
      if (scannedVin && scannedVehicleIdx !== undefined) {
        const idx = parseInt(scannedVehicleIdx);
        if (!isNaN(idx)) {
          updateVehicle(idx, { vinConfirmed: false, vinMismatch: scannedVin });
        }
      }
    }, [scannedVin, scannedVehicleIdx])
  );

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('shipments')
        .select('*, vehicles(*)')
        .eq('id', id)
        .single();

      if (data) {
        setLoad(data);
        setVehicles(
          (data.vehicles ?? []).map((v: Vehicle) => ({
            vehicleId: v.id,
            vin: v.vin,
            vinConfirmed: false,
            vinMismatch: '',
            condition: 'good',
            damages: [],
            isOperable: v.is_operable,
            odometer: '',
            notes: '',
          }))
        );
      }
      setLoading(false);
    }
    load();
  }, [id]);

  function updateVehicle(idx: number, patch: Partial<VehicleBOL>) {
    setVehicles(prev => prev.map((v, i) => i === idx ? { ...v, ...patch } : v));
  }

  function addDamage(idx: number) {
    updateVehicle(idx, {
      damages: [...vehicles[idx].damages, { area: 'front', type: 'Scratch', notes: '' }],
    });
  }

  function updateDamage(vIdx: number, dIdx: number, patch: any) {
    const updated = [...vehicles[vIdx].damages];
    updated[dIdx] = { ...updated[dIdx], ...patch };
    updateVehicle(vIdx, { damages: updated });
  }

  function removeDamage(vIdx: number, dIdx: number) {
    const updated = vehicles[vIdx].damages.filter((_, i) => i !== dIdx);
    updateVehicle(vIdx, { damages: updated });
  }

  function openSignature(target: 'carrier' | 'customer') {
    setSigTarget(target);
    setShowSigModal(true);
  }

  function handleSignature(sig: string) {
    if (sigTarget === 'carrier') setCarrierSig(sig);
    else setCustomerSig(sig);
    setShowSigModal(false);
  }

  async function submitBOL() {
    if (!carrierSig) return Alert.alert('Required', 'Carrier signature is required.');
    if (!customerSig) return Alert.alert('Required', 'Customer signature is required.');
    if (!customerName.trim()) return Alert.alert('Required', 'Customer name is required.');

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Upload signatures to storage
      const uploadSig = async (base64: string, name: string) => {
        const blob = await fetch(base64).then(r => r.blob());
        const fileName = `${id}/bol/${name}_${Date.now()}.png`;
        await supabase.storage.from('carrier-pod').upload(fileName, blob, { contentType: 'image/png' });
        const { data: { publicUrl } } = supabase.storage.from('carrier-pod').getPublicUrl(fileName);
        return publicUrl;
      };

      const carrierSigUrl = await uploadSig(carrierSig, 'carrier_sig');
      const customerSigUrl = await uploadSig(customerSig, 'customer_sig');

      // Save BOL data for each vehicle
      for (const v of vehicles) {
        await supabase.from('vehicle_documents').insert({
          vehicle_id: v.vehicleId,
          shipment_id: id,
          document_type: isPickup ? 'pickup_bol' : 'delivery_bol',
          document_name: `${isPickup ? 'Pickup' : 'Delivery'} BOL`,
          file_url: carrierSigUrl,
          status: 'verified',
          notes: JSON.stringify({
            vin: v.vin,
            vin_confirmed: v.vinConfirmed,
            vin_mismatch: v.vinMismatch,
            condition: v.condition,
            damages: v.damages,
            is_operable: v.isOperable,
            odometer: v.odometer,
            notes: v.notes,
            carrier_signature: carrierSigUrl,
            customer_signature: customerSigUrl,
            customer_name: customerName,
            stage: isPickup ? 'pickup' : 'delivery',
            signed_at: new Date().toISOString(),
          }),
          uploaded_by: user?.id,
          uploaded_at: new Date().toISOString(),
          verified_at: new Date().toISOString(),
        });
      }

      // Log shipment event
      await supabase.from('shipment_events').insert({
        shipment_id: id,
        event_type: isPickup ? 'bol_pickup_signed' : 'bol_delivery_signed',
        description: `${isPickup ? 'Pickup' : 'Delivery'} BOL signed by ${customerName}`,
        event_time: new Date().toISOString(),
      });

      // If delivery BOL, mark POD as uploaded
      if (!isPickup) {
        await supabase.from('shipments').update({ carrier_pod_uploaded: true }).eq('id', id);
      }

      setStep('complete');
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to submit BOL');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !load) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // ─── COMPLETE SCREEN ────────────────────────────────────────────────────
  if (step === 'complete') {
    return (
      <View style={styles.completeContainer}>
        <Stack.Screen options={{ title: 'BOL Signed', headerLeft: () => null }} />
        <Text style={styles.completeIcon}>✅</Text>
        <Text style={styles.completeTitle}>{title} Signed</Text>
        <Text style={styles.completeSub}>
          {vehicles.length} vehicle{vehicles.length !== 1 ? 's' : ''} · {customerName}
        </Text>
        <Text style={styles.completeSub2}>
          BOL saved and linked to this shipment.
        </Text>
        <TouchableOpacity style={styles.doneBtn} onPress={() => router.back()}>
          <Text style={styles.doneBtnText}>Back to Load</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── SIGNATURE STEP ─────────────────────────────────────────────────────
  if (step === 'signature' || step === 'customer_sig') {
    return (
      <>
        <Stack.Screen options={{ title: step === 'signature' ? 'Carrier Signature' : 'Customer Signature' }} />
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
          <Text style={styles.sectionTitle}>
            {step === 'signature' ? '📝 Carrier Signature' : '👤 Customer Signature'}
          </Text>
          <Text style={styles.sigInstructions}>
            {step === 'signature'
              ? 'Sign below to confirm vehicle condition at ' + (isPickup ? 'pickup' : 'delivery')
              : 'Customer or representative signs to acknowledge vehicle ' + (isPickup ? 'pickup' : 'delivery')
            }
          </Text>

          {step === 'customer_sig' && (
            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Customer / Rep Name</Text>
              <TextInput
                style={styles.input}
                value={customerName}
                onChangeText={setCustomerName}
                placeholder="Full name of person signing"
                placeholderTextColor={colors.textDim}
              />
            </View>
          )}

          {/* Signature area */}
          <TouchableOpacity
            style={[
              styles.sigBox,
              (step === 'signature' ? carrierSig : customerSig) && styles.sigBoxSigned,
            ]}
            onPress={() => openSignature(step === 'signature' ? 'carrier' : 'customer')}
          >
            {(step === 'signature' ? carrierSig : customerSig) ? (
              <Text style={styles.sigDone}>✅ Signature captured — tap to redo</Text>
            ) : (
              <>
                <Text style={styles.sigIcon}>✍️</Text>
                <Text style={styles.sigPrompt}>Tap to sign</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Vehicle summary */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>BOL Summary</Text>
            {vehicles.map(v => (
              <View key={v.vehicleId} style={styles.summaryRow}>
                <Text style={styles.summaryVin}>VIN: {v.vin}</Text>
                <Text style={styles.summaryCondition}>
                  Condition: {v.condition} · {v.damages.length} damage note{v.damages.length !== 1 ? 's' : ''}
                </Text>
              </View>
            ))}
            <Text style={styles.summaryMeta}>
              {isPickup ? 'Pickup' : 'Delivery'} · {new Date().toLocaleDateString()} · {load.origin_city} → {load.destination_city}
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.nextBtn,
              (!(step === 'signature' ? carrierSig : customerSig) || (step === 'customer_sig' && !customerName.trim())) && styles.btnDisabled
            ]}
            onPress={() => {
              if (step === 'signature') setStep('customer_sig');
              else submitBOL();
            }}
            disabled={
              !(step === 'signature' ? carrierSig : customerSig) ||
              (step === 'customer_sig' && !customerName.trim()) ||
              submitting
            }
          >
            {submitting
              ? <ActivityIndicator color={colors.white} />
              : <Text style={styles.nextBtnText}>
                  {step === 'signature' ? 'Next: Customer Signature →' : 'Submit BOL ✓'}
                </Text>
            }
          </TouchableOpacity>
        </ScrollView>

        {/* Signature Modal */}
        <Modal visible={showSigModal} animationType="slide">
          <View style={styles.sigModal}>
            <Text style={styles.sigModalTitle}>Sign Here</Text>
            <SignatureCanvas
              ref={sigRef}
              onOK={handleSignature}
              onEmpty={() => Alert.alert('Empty', 'Please draw your signature')}
              descriptionText=""
              clearText="Clear"
              confirmText="Save"
              webStyle={`
                .m-signature-pad { border: none; box-shadow: none; background: #1e293b; }
                .m-signature-pad--body { border: none; background: #1e293b; }
                .m-signature-pad--footer { background: #0f172a; padding: 8px; }
                .m-signature-pad--footer .button { background: #2563eb; color: white; border-radius: 8px; padding: 10px 20px; border: none; font-size: 16px; }
                .m-signature-pad--footer .button.clear { background: #334155; }
                body, html { background: #1e293b; }
              `}
              style={styles.sigPad}
            />
            <TouchableOpacity style={styles.sigCancelBtn} onPress={() => setShowSigModal(false)}>
              <Text style={styles.sigCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Modal>
      </>
    );
  }

  // ─── VEHICLE CONDITION STEP ─────────────────────────────────────────────
  const vehicle = vehicles[currentVehicleIdx];

  return (
    <>
      <Stack.Screen options={{ title: `${title} — Vehicle ${currentVehicleIdx + 1}/${vehicles.length}` }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>

        {/* Progress */}
        <View style={styles.progressRow}>
          {vehicles.map((_, i) => (
            <View key={i} style={[styles.progressStep, i <= currentVehicleIdx && styles.progressStepDone]} />
          ))}
        </View>

        {/* VIN Confirmation */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>VIN Confirmation</Text>
          <Text style={styles.vinDisplay}>{vehicle.vin}</Text>
          <Text style={styles.vinLabel}>Expected VIN — verify against the vehicle</Text>

          <View style={styles.vinBtnRow}>
            <TouchableOpacity
              style={[styles.vinBtn, vehicle.vinConfirmed && styles.vinBtnConfirmed]}
              onPress={() => updateVehicle(currentVehicleIdx, { vinConfirmed: true, vinMismatch: '' })}
            >
              <Text style={[styles.vinBtnText, vehicle.vinConfirmed && styles.vinBtnTextActive]}>
                ✅ VIN Matches
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.vinBtn, vehicle.vinMismatch ? styles.vinBtnMismatch : null]}
              onPress={() => {
                Alert.prompt(
                  'VIN Mismatch',
                  'Enter the actual VIN on the vehicle:',
                  (text) => {
                    if (text) updateVehicle(currentVehicleIdx, { vinConfirmed: false, vinMismatch: text });
                  },
                  'plain-text',
                  vehicle.vinMismatch,
                );
              }}
            >
              <Text style={[styles.vinBtnText, vehicle.vinMismatch ? styles.vinBtnTextMismatch : null]}>
                ⚠️ {vehicle.vinMismatch ? `Mismatch: ${vehicle.vinMismatch}` : 'VIN Mismatch'}
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.scanVinBtn}
            onPress={() => router.push({
              pathname: '/vin-scanner',
              params: {
                returnTo: `/load/bol`,
                field: 'vin',
                returnId: id,
                returnStage: stage,
                returnVehicleIdx: String(currentVehicleIdx),
              }
            })}
          >
            <Text style={styles.scanVinText}>📷 Scan VIN with Camera</Text>
          </TouchableOpacity>
        </View>

        {/* Condition */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Overall Condition</Text>
          <View style={styles.conditionRow}>
            {CONDITIONS.map(c => (
              <TouchableOpacity
                key={c.key}
                style={[
                  styles.conditionBtn,
                  vehicle.condition === c.key && { borderColor: c.color, backgroundColor: c.color + '22' },
                ]}
                onPress={() => updateVehicle(currentVehicleIdx, { condition: c.key })}
              >
                <Text style={[
                  styles.conditionText,
                  vehicle.condition === c.key && { color: c.color, fontWeight: '700' },
                ]}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Operable */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Vehicle Operability</Text>
          <View style={styles.operableRow}>
            <TouchableOpacity
              style={[styles.operableBtn, vehicle.isOperable && styles.operableBtnActive]}
              onPress={() => updateVehicle(currentVehicleIdx, { isOperable: true })}
            >
              <Text style={[styles.operableText, vehicle.isOperable && styles.operableTextActive]}>✅ Operable</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.operableBtn, !vehicle.isOperable && styles.operableBtnInop]}
              onPress={() => updateVehicle(currentVehicleIdx, { isOperable: false })}
            >
              <Text style={[styles.operableText, !vehicle.isOperable && styles.operableTextInop]}>⚠️ Inoperable</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Odometer */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Odometer Reading</Text>
          <TextInput
            style={styles.input}
            value={vehicle.odometer}
            onChangeText={v => updateVehicle(currentVehicleIdx, { odometer: v })}
            placeholder="e.g. 42,500"
            placeholderTextColor={colors.textDim}
            keyboardType="numeric"
          />
        </View>

        {/* Damage Notes */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Pre-existing Damage</Text>
            <TouchableOpacity onPress={() => addDamage(currentVehicleIdx)}>
              <Text style={styles.addDamageBtn}>+ Add</Text>
            </TouchableOpacity>
          </View>

          {vehicle.damages.length === 0 ? (
            <Text style={styles.noDamage}>No damage noted — tap + Add to record any</Text>
          ) : (
            vehicle.damages.map((dmg, dIdx) => (
              <View key={dIdx} style={styles.damageRow}>
                <View style={styles.damageSelects}>
                  {/* Area */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                    {DAMAGE_AREAS.map(a => (
                      <TouchableOpacity
                        key={a.key}
                        style={[styles.chip, dmg.area === a.key && styles.chipActive]}
                        onPress={() => updateDamage(currentVehicleIdx, dIdx, { area: a.key })}
                      >
                        <Text style={styles.chipText}>{a.emoji} {a.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  {/* Type */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                    {DAMAGE_TYPES.map(t => (
                      <TouchableOpacity
                        key={t}
                        style={[styles.chip, dmg.type === t && styles.chipActive]}
                        onPress={() => updateDamage(currentVehicleIdx, dIdx, { type: t })}
                      >
                        <Text style={styles.chipText}>{t}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  <TextInput
                    style={styles.damageNoteInput}
                    value={dmg.notes}
                    onChangeText={v => updateDamage(currentVehicleIdx, dIdx, { notes: v })}
                    placeholder="Additional notes..."
                    placeholderTextColor={colors.textDim}
                  />
                </View>
                <TouchableOpacity onPress={() => removeDamage(currentVehicleIdx, dIdx)}>
                  <Text style={styles.removeBtn}>✕</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* General Notes */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Additional Notes</Text>
          <TextInput
            style={styles.textArea}
            value={vehicle.notes}
            onChangeText={v => updateVehicle(currentVehicleIdx, { notes: v })}
            placeholder="Any other observations..."
            placeholderTextColor={colors.textDim}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* Next Vehicle / Proceed to Signatures */}
        <TouchableOpacity
          style={[styles.nextBtn, !vehicle.vinConfirmed && !vehicle.vinMismatch && styles.btnDisabled]}
          onPress={() => {
            if (!vehicle.vinConfirmed && !vehicle.vinMismatch) {
              return Alert.alert('VIN Required', 'Please confirm or note a VIN mismatch before continuing.');
            }
            if (currentVehicleIdx < vehicles.length - 1) {
              setCurrentVehicleIdx(i => i + 1);
            } else {
              setStep('signature');
            }
          }}
        >
          <Text style={styles.nextBtnText}>
            {currentVehicleIdx < vehicles.length - 1
              ? `Next Vehicle (${currentVehicleIdx + 2}/${vehicles.length}) →`
              : 'Proceed to Signatures →'
            }
          </Text>
        </TouchableOpacity>

      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 12 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  progressRow: { flexDirection: 'row', gap: 6 },
  progressStep: { flex: 1, height: 4, backgroundColor: colors.bgCardAlt, borderRadius: 2 },
  progressStepDone: { backgroundColor: colors.primary },
  card: {
    backgroundColor: colors.bgCard, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border, padding: 16, gap: 10,
  },
  cardTitle: { color: colors.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  vinDisplay: { color: colors.text, fontSize: 22, fontWeight: '800', letterSpacing: 2 },
  vinLabel: { color: colors.textMuted, fontSize: 12 },
  vinBtnRow: { flexDirection: 'row', gap: 8 },
  vinBtn: {
    flex: 1, borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, padding: 10, alignItems: 'center', backgroundColor: colors.bgCardAlt,
  },
  vinBtnConfirmed: { borderColor: colors.success, backgroundColor: colors.success + '22' },
  vinBtnMismatch: { borderColor: colors.danger, backgroundColor: colors.danger + '22' },
  vinBtnText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  vinBtnTextActive: { color: colors.success },
  vinBtnTextMismatch: { color: colors.danger },
  scanVinBtn: {
    borderWidth: 1, borderColor: colors.primary, borderRadius: 8,
    padding: 10, alignItems: 'center', marginTop: 4,
  },
  scanVinText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  conditionRow: { flexDirection: 'row', gap: 8 },
  conditionBtn: {
    flex: 1, borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, padding: 10, alignItems: 'center',
  },
  conditionText: { color: colors.textMuted, fontSize: 13 },
  operableRow: { flexDirection: 'row', gap: 8 },
  operableBtn: {
    flex: 1, borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, padding: 12, alignItems: 'center',
  },
  operableBtnActive: { borderColor: colors.success, backgroundColor: colors.success + '22' },
  operableBtnInop: { borderColor: colors.warning, backgroundColor: colors.warning + '22' },
  operableText: { color: colors.textMuted, fontWeight: '600' },
  operableTextActive: { color: colors.success },
  operableTextInop: { color: colors.warning },
  input: {
    backgroundColor: colors.bgCardAlt, borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, padding: 12, color: colors.text, fontSize: 15,
  },
  textArea: {
    backgroundColor: colors.bgCardAlt, borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, padding: 12, color: colors.text, fontSize: 15, minHeight: 80,
  },
  addDamageBtn: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  noDamage: { color: colors.textDim, fontSize: 13, textAlign: 'center', paddingVertical: 8 },
  damageRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  damageSelects: { flex: 1, gap: 6 },
  chipScroll: { flexGrow: 0 },
  chip: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 16,
    paddingHorizontal: 10, paddingVertical: 5, marginRight: 6, backgroundColor: colors.bgCardAlt,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primary + '22' },
  chipText: { color: colors.textMuted, fontSize: 12 },
  damageNoteInput: {
    backgroundColor: colors.bgCardAlt, borderWidth: 1, borderColor: colors.border,
    borderRadius: 6, padding: 8, color: colors.text, fontSize: 13,
  },
  removeBtn: { color: colors.danger, fontSize: 18, paddingTop: 4 },
  nextBtn: {
    backgroundColor: colors.primary, borderRadius: 12,
    padding: 16, alignItems: 'center', marginTop: 4,
  },
  btnDisabled: { backgroundColor: colors.textDim },
  nextBtnText: { color: colors.white, fontSize: 16, fontWeight: '800' },
  fieldWrap: { gap: 6 },
  label: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  sigInstructions: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  sigBox: {
    height: 140, backgroundColor: colors.bgCard, borderRadius: 12,
    borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center', gap: 8,
  },
  sigBoxSigned: { borderColor: colors.success, borderStyle: 'solid' },
  sigIcon: { fontSize: 36 },
  sigPrompt: { color: colors.textMuted, fontSize: 16 },
  sigDone: { color: colors.success, fontWeight: '600', fontSize: 14 },
  summaryCard: {
    backgroundColor: colors.bgCard, borderRadius: 12, borderWidth: 1,
    borderColor: colors.border, padding: 14, gap: 8,
  },
  summaryTitle: { color: colors.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  summaryRow: { gap: 2 },
  summaryVin: { color: colors.text, fontWeight: '700', fontSize: 13 },
  summaryCondition: { color: colors.textMuted, fontSize: 12 },
  summaryMeta: { color: colors.textDim, fontSize: 12, marginTop: 4 },
  sigModal: { flex: 1, backgroundColor: colors.bg, padding: 16, gap: 12 },
  sigModalTitle: { color: colors.text, fontSize: 20, fontWeight: '800', textAlign: 'center', paddingTop: 16 },
  sigPad: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  sigCancelBtn: { padding: 14, alignItems: 'center' },
  sigCancelText: { color: colors.textMuted, fontSize: 16 },
  completeContainer: {
    flex: 1, backgroundColor: colors.bg, justifyContent: 'center',
    alignItems: 'center', padding: 32, gap: 12,
  },
  completeIcon: { fontSize: 72 },
  completeTitle: { color: colors.text, fontSize: 28, fontWeight: '800' },
  completeSub: { color: colors.textMuted, fontSize: 16 },
  completeSub2: { color: colors.textDim, fontSize: 14 },
  doneBtn: {
    backgroundColor: colors.primary, borderRadius: 12,
    paddingVertical: 16, paddingHorizontal: 48, marginTop: 16,
  },
  doneBtnText: { color: colors.white, fontSize: 16, fontWeight: '800' },
});
