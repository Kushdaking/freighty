import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/colors';

const BASE_URL = 'https://app.prevaylos.com';

function getDaysUntilExpiry(dateStr: string): number {
  if (!dateStr) return 9999;
  const now = new Date();
  const expiry = new Date(dateStr);
  return Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export default function FleetScreen() {
  const [trucks, setTrucks] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'trucks' | 'drivers'>('trucks');
  const [carrierId, setCarrierId] = useState<string | null>(null);

  // Add truck
  const [showAddTruck, setShowAddTruck] = useState(false);
  const [truckForm, setTruckForm] = useState({ unit_number: '', make: '', model: '', year: '', license_plate: '', state: '', transport_type: 'open' });

  // Select truck modal
  const [showSelectTruck, setShowSelectTruck] = useState(false);
  const [selectedLoadId, setSelectedLoadId] = useState<string | null>(null);

  useEffect(() => {
    loadCarrierId();
  }, []);

  async function loadCarrierId() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCarrierId(user.id);
      loadFleet(user.id);
    }
  }

  async function loadFleet(cid?: string) {
    const id = cid || carrierId;
    if (!id) return;
    setLoading(true);
    try {
      const [trucksRes, driversRes] = await Promise.all([
        fetch(`${BASE_URL}/api/fleet/trucks?carrier_user_id=${id}`),
        fetch(`${BASE_URL}/api/fleet/drivers?carrier_user_id=${id}`),
      ]);
      if (trucksRes.ok) setTrucks(await trucksRes.json());
      if (driversRes.ok) setDrivers(await driversRes.json());
    } catch (err) {
      console.error('Fleet load error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadFleet();
    setRefreshing(false);
  }

  async function addTruck() {
    if (!truckForm.make || !truckForm.model) {
      Alert.alert('Required', 'Please enter make and model');
      return;
    }
    try {
      const res = await fetch(`${BASE_URL}/api/fleet/trucks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...truckForm, carrier_user_id: carrierId, year: truckForm.year ? parseInt(truckForm.year) : null }),
      });
      if (res.ok) {
        setShowAddTruck(false);
        setTruckForm({ unit_number: '', make: '', model: '', year: '', license_plate: '', state: '', transport_type: 'open' });
        await loadFleet();
        Alert.alert('✅ Truck added!');
      } else {
        const err = await res.json();
        Alert.alert('Error', err.error || 'Failed to add truck');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  }

  async function selectTruckForLoad(truckId: string) {
    if (!selectedLoadId) return;
    try {
      const res = await fetch(`${BASE_URL}/api/fleet/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ truck_id: truckId, shipment_id: selectedLoadId, driver_id: drivers.find((d: any) => d.current_truck_id === truckId)?.id }),
      });
      if (res.ok) {
        setShowSelectTruck(false);
        setSelectedLoadId(null);
        Alert.alert('✅ Truck assigned to load!');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  }

  function getTruckStatusColor(truck: any): string {
    if (truck.current_shipment_id) return colors.primary;
    if (!truck.is_active) return colors.textDim;
    return colors.success;
  }

  function getTruckStatusLabel(truck: any): string {
    if (truck.current_shipment_id) return 'On Load';
    if (!truck.is_active) return 'Inactive';
    return 'Available';
  }

  if (loading && trucks.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading fleet...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>🚛 My Fleet</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddTruck(true)}>
          <Text style={styles.addBtnText}>+ Truck</Text>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{trucks.length}</Text>
          <Text style={styles.statLabel}>Trucks</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNum, { color: colors.success }]}>
            {trucks.filter(t => !t.current_shipment_id && t.is_active).length}
          </Text>
          <Text style={styles.statLabel}>Available</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNum, { color: colors.primary }]}>
            {trucks.filter(t => t.current_shipment_id).length}
          </Text>
          <Text style={styles.statLabel}>On Load</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{drivers.length}</Text>
          <Text style={styles.statLabel}>Drivers</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {(['trucks', 'drivers'] as const).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'trucks' ? `Trucks (${trucks.length})` : `Drivers (${drivers.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {activeTab === 'trucks' ? (
          trucks.length === 0 ? (
            <Text style={styles.empty}>No trucks. Add one to get started.</Text>
          ) : (
            trucks.map(truck => {
              const statusColor = getTruckStatusColor(truck);
              const statusLabel = getTruckStatusLabel(truck);
              const assignedDriver = drivers.find(d => d.current_truck_id === truck.id);
              return (
                <View key={truck.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>
                        #{truck.unit_number || 'N/A'} — {truck.year} {truck.make} {truck.model}
                      </Text>
                      <View style={styles.badgeRow}>
                        <View style={[styles.badge, { borderColor: statusColor + '40' }]}>
                          <Text style={[styles.badgeText, { color: statusColor }]}>{statusLabel}</Text>
                        </View>
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>{truck.transport_type?.toUpperCase()}</Text>
                        </View>
                        <Text style={styles.cardSub}>{truck.capacity_vehicles || 8} vehicles</Text>
                      </View>
                    </View>
                  </View>
                  {truck.license_plate && (
                    <Text style={styles.cardSub}>Plate: {truck.license_plate} ({truck.state})</Text>
                  )}
                  {assignedDriver && (
                    <Text style={styles.cardSub}>Driver: {assignedDriver.name}</Text>
                  )}
                  {!truck.current_shipment_id && truck.is_active && (
                    <TouchableOpacity
                      style={styles.selectBtn}
                      onPress={() => {
                        Alert.alert('Use This Truck', `Set truck #${truck.unit_number} as active for your next load?`, [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Use This Truck', onPress: () => Alert.alert('✅ Truck selected for next assignment') },
                        ]);
                      }}
                    >
                      <Text style={styles.selectBtnText}>Use This Truck</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )
        ) : (
          drivers.length === 0 ? (
            <Text style={styles.empty}>No drivers registered.</Text>
          ) : (
            drivers.map(driver => {
              const days = getDaysUntilExpiry(driver.license_expiry);
              const expiryColor = days <= 30 ? colors.danger : days <= 90 ? colors.warning : colors.success;
              const assignedTruck = trucks.find(t => t.id === driver.current_truck_id);
              return (
                <View key={driver.id} style={styles.card}>
                  <Text style={styles.cardTitle}>{driver.name}</Text>
                  <View style={styles.badgeRow}>
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>CDL-{driver.cdl_class}</Text>
                    </View>
                    {driver.license_expiry && (
                      <View style={[styles.badge, { borderColor: expiryColor + '40' }]}>
                        <Text style={[styles.badgeText, { color: expiryColor }]}>
                          {days <= 0 ? 'EXPIRED' : `${days}d`}
                        </Text>
                      </View>
                    )}
                  </View>
                  {driver.phone && <Text style={styles.cardSub}>📞 {driver.phone}</Text>}
                  {assignedTruck && (
                    <Text style={styles.cardSub}>
                      Truck: #{assignedTruck.unit_number} {assignedTruck.make} {assignedTruck.model}
                    </Text>
                  )}
                  {days <= 90 && days > 0 && (
                    <View style={[styles.alert, { borderColor: expiryColor + '30' }]}>
                      <Text style={[styles.alertText, { color: expiryColor }]}>
                        ⚠️ License expires in {days} days ({driver.license_expiry})
                      </Text>
                    </View>
                  )}
                  {days <= 0 && (
                    <View style={[styles.alert, { borderColor: colors.danger + '30' }]}>
                      <Text style={[styles.alertText, { color: colors.danger }]}>
                        🔴 License EXPIRED — driver cannot legally operate
                      </Text>
                    </View>
                  )}
                </View>
              );
            })
          )
        )}
        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Add Truck Modal */}
      <Modal visible={showAddTruck} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>🚛 Add Truck</Text>
            {[
              { key: 'unit_number', label: 'Unit Number', placeholder: 'T-001' },
              { key: 'make', label: 'Make *', placeholder: 'Peterbilt' },
              { key: 'model', label: 'Model *', placeholder: '389' },
              { key: 'year', label: 'Year', placeholder: '2022' },
              { key: 'license_plate', label: 'License Plate', placeholder: 'ABC1234' },
              { key: 'state', label: 'State', placeholder: 'MI' },
            ].map(f => (
              <View key={f.key} style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{f.label}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={f.placeholder}
                  placeholderTextColor={colors.textDim}
                  value={(truckForm as any)[f.key]}
                  onChangeText={v => setTruckForm(prev => ({ ...prev, [f.key]: v }))}
                  keyboardType={f.key === 'year' ? 'numeric' : 'default'}
                />
              </View>
            ))}
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAddTruck(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={addTruck}>
                <Text style={styles.saveBtnText}>Add Truck</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  loadingText: { color: colors.textMuted, marginTop: 12, fontSize: 14 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  addBtn: { backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  statsRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 12 },
  statCard: { flex: 1, backgroundColor: colors.bgCard, borderRadius: 10, padding: 12, alignItems: 'center' },
  statNum: { fontSize: 22, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 10, color: colors.textDim, marginTop: 2 },
  tabRow: { flexDirection: 'row', marginHorizontal: 16, backgroundColor: colors.bgCard, borderRadius: 10, padding: 4, marginBottom: 12 },
  tab: { flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: colors.bgCardAlt },
  tabText: { fontSize: 13, color: colors.textDim, fontWeight: '600' },
  tabTextActive: { color: colors.text },
  list: { flex: 1, paddingHorizontal: 16 },
  empty: { color: colors.textDim, fontSize: 14, textAlign: 'center', marginTop: 40 },
  card: { backgroundColor: colors.bgCard, borderRadius: 12, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 4 },
  cardSub: { fontSize: 12, color: colors.textDim, marginTop: 2 },
  badgeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 2 },
  badge: { borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  alert: { marginTop: 8, borderWidth: 1, borderRadius: 8, padding: 8 },
  alertText: { fontSize: 12, fontWeight: '600' },
  selectBtn: { marginTop: 10, backgroundColor: colors.primary + '20', borderRadius: 8, padding: 8, alignItems: 'center', borderWidth: 1, borderColor: colors.primary + '40' },
  selectBtnText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.bgCard, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 20 },
  inputGroup: { marginBottom: 12 },
  inputLabel: { fontSize: 11, color: colors.textMuted, marginBottom: 4 },
  input: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, color: colors.text, fontSize: 14 },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, alignItems: 'center' },
  cancelText: { color: colors.textMuted, fontSize: 14 },
  saveBtn: { flex: 1, backgroundColor: colors.primary, borderRadius: 10, padding: 12, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
