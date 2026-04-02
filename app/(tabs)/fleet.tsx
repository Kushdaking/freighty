import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Modal, TextInput, Alert, ActivityIndicator, RefreshControl
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';

const GOLD = '#C9A84C';
const BG = '#0a0f1a';
const CARD = '#111827';
const BORDER = '#1e2d40';
const TEXT = '#f0f4f8';
const DIM = '#a8c4d8';
const GREEN = '#34d399';
const AMBER = '#f59e0b';
const RED = '#ef4444';

const VEHICLE_TYPES = ['Car', 'SUV', 'Truck', 'Van', 'Motorcycle', 'Boat', 'RV', 'Other'];
const STATUS_OPTIONS = ['Active', 'Maintenance', 'Inactive'];

interface Vehicle {
  id: string;
  vin: string;
  year: string;
  make: string;
  model: string;
  color: string;
  license_plate: string;
  plate_state: string;
  vehicle_type: string;
  status: string;
  last_inspection?: string;
}

export default function FleetScreen() {
  const insets = useSafeAreaInsets();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    vin: '', year: '', make: '', model: '', color: '',
    license_plate: '', plate_state: '', vehicle_type: 'Car', status: 'Active'
  });

  const loadVehicles = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      // Try carrier_vehicles table, fallback to empty
      const { data, error } = await supabase
        .from('carrier_vehicles')
        .select('*')
        .eq('carrier_user_id', session.user.id)
        .order('created_at', { ascending: false });
      if (!error) setVehicles(data || []);
    } catch (e) {
      // Table may not exist yet
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadVehicles(); }, []);

  const saveVehicle = async () => {
    if (!form.vin || !form.year || !form.make || !form.model) {
      Alert.alert('Missing Info', 'VIN, Year, Make and Model are required');
      return;
    }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { error } = await supabase.from('carrier_vehicles').insert({
        ...form, carrier_user_id: session.user.id
      });
      if (error) throw error;
      setShowModal(false);
      setForm({ vin: '', year: '', make: '', model: '', color: '', license_plate: '', plate_state: '', vehicle_type: 'Car', status: 'Active' });
      loadVehicles();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not save vehicle');
    } finally {
      setSaving(false);
    }
  };

  const statusColor = (s: string) => s === 'Active' ? GREEN : s === 'Maintenance' ? AMBER : RED;

  if (loading) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={GOLD} size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>MY FLEET</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowModal(true)}>
          <Text style={styles.addBtnText}>+ ADD VEHICLE</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadVehicles(); }} tintColor={GOLD} />}
      >
        {vehicles.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>🚗</Text>
            <Text style={styles.emptyTitle}>NO VEHICLES YET</Text>
            <Text style={styles.emptySubtitle}>Add your first vehicle to track your fleet</Text>
            <TouchableOpacity style={[styles.addBtn, { marginTop: 16 }]} onPress={() => setShowModal(true)}>
              <Text style={styles.addBtnText}>+ ADD VEHICLE</Text>
            </TouchableOpacity>
          </View>
        ) : (
          vehicles.map(v => (
            <View key={v.id} style={styles.vehicleCard}>
              <View style={styles.vehicleHeader}>
                <Text style={styles.vehicleName}>{v.year} {v.make} {v.model}</Text>
                <View style={[styles.statusBadge, { borderColor: statusColor(v.status) + '60', backgroundColor: statusColor(v.status) + '20' }]}>
                  <Text style={[styles.statusText, { color: statusColor(v.status) }]}>{v.status.toUpperCase()}</Text>
                </View>
              </View>
              <View style={styles.vehicleDetails}>
                <Text style={styles.detailLabel}>VIN</Text>
                <Text style={styles.detailValue}>{v.vin}</Text>
              </View>
              {v.license_plate && (
                <View style={styles.vehicleDetails}>
                  <Text style={styles.detailLabel}>PLATE</Text>
                  <Text style={styles.detailValue}>{v.license_plate} {v.plate_state}</Text>
                </View>
              )}
              <View style={styles.vehicleDetails}>
                <Text style={styles.detailLabel}>TYPE</Text>
                <Text style={styles.detailValue}>{v.vehicle_type}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Add Vehicle Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>ADD VEHICLE</Text>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Text style={{ color: DIM, fontSize: 24 }}>×</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
            {[
              { label: 'VIN *', key: 'vin', placeholder: '17-character VIN' },
              { label: 'YEAR *', key: 'year', placeholder: '2020', keyboardType: 'numeric' },
              { label: 'MAKE *', key: 'make', placeholder: 'Toyota' },
              { label: 'MODEL *', key: 'model', placeholder: 'Camry' },
              { label: 'COLOR', key: 'color', placeholder: 'White' },
              { label: 'LICENSE PLATE', key: 'license_plate', placeholder: 'ABC-1234' },
              { label: 'PLATE STATE', key: 'plate_state', placeholder: 'MI' },
            ].map(field => (
              <View key={field.key} style={styles.formField}>
                <Text style={styles.fieldLabel}>{field.label}</Text>
                <TextInput
                  style={styles.input}
                  value={(form as any)[field.key]}
                  onChangeText={v => setForm(f => ({ ...f, [field.key]: v }))}
                  placeholder={field.placeholder}
                  placeholderTextColor="#4a6580"
                  autoCapitalize={field.key === 'vin' ? 'characters' : 'words'}
                />
              </View>
            ))}

            <Text style={styles.fieldLabel}>VEHICLE TYPE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {VEHICLE_TYPES.map(t => (
                <TouchableOpacity
                  key={t}
                  onPress={() => setForm(f => ({ ...f, vehicle_type: t }))}
                  style={[styles.chip, form.vehicle_type === t && styles.chipActive]}
                >
                  <Text style={[styles.chipText, form.vehicle_type === t && styles.chipTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.fieldLabel}>STATUS</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
              {STATUS_OPTIONS.map(s => (
                <TouchableOpacity
                  key={s}
                  onPress={() => setForm(f => ({ ...f, status: s }))}
                  style={[styles.chip, form.status === s && styles.chipActive]}
                >
                  <Text style={[styles.chipText, form.status === s && styles.chipTextActive]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={saveVehicle} disabled={saving}>
              {saving ? <ActivityIndicator color="#0a0f1a" /> : <Text style={styles.saveBtnText}>SAVE VEHICLE</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: BORDER },
  title: { fontSize: 28, color: GOLD, fontWeight: '800', letterSpacing: 2 },
  addBtn: { backgroundColor: GOLD, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnText: { color: '#0a0f1a', fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, color: DIM, fontWeight: '700', letterSpacing: 2 },
  emptySubtitle: { fontSize: 14, color: '#556b80', marginTop: 6 },
  vehicleCard: { backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 12, padding: 16, marginBottom: 12 },
  vehicleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  vehicleName: { fontSize: 16, color: TEXT, fontWeight: '700' },
  statusBadge: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  vehicleDetails: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  detailLabel: { fontSize: 11, color: DIM, letterSpacing: 1, fontWeight: '600' },
  detailValue: { fontSize: 13, color: TEXT },
  modal: { flex: 1, backgroundColor: BG },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: BORDER },
  modalTitle: { fontSize: 22, color: GOLD, fontWeight: '800', letterSpacing: 2 },
  formField: { marginBottom: 16 },
  fieldLabel: { fontSize: 11, color: DIM, letterSpacing: 1, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase' },
  input: { backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 8, padding: 12, color: TEXT, fontSize: 15 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: BORDER, marginRight: 8 },
  chipActive: { backgroundColor: GOLD, borderColor: GOLD },
  chipText: { color: DIM, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#0a0f1a' },
  saveBtn: { backgroundColor: GOLD, borderRadius: 10, padding: 14, alignItems: 'center' },
  saveBtnText: { color: '#0a0f1a', fontSize: 16, fontWeight: '800', letterSpacing: 1 },
});
