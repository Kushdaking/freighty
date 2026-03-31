/**
 * Load Instructions Screen — "Loading for Dummies"
 * Shows load-specific instructions based on vehicle types, operability,
 * transport type, and destination.
 */

import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/colors';
import type { Shipment, Vehicle } from '@/lib/types';

interface InstructionSection {
  title: string;
  emoji: string;
  items: string[];
  urgent?: boolean;
}

function buildInstructions(shipment: Shipment, vehicles: Vehicle[]): InstructionSection[] {
  const sections: InstructionSection[] = [];
  const hasInop = vehicles.some(v => !v.is_operable);
  const hasOperable = vehicles.some(v => v.is_operable);
  const vehicleCount = vehicles.length;

  // ─── Safety First ───────────────────────────────────────────────────────
  sections.push({
    title: 'Pre-Load Safety Check',
    emoji: '🦺',
    items: [
      'Ensure truck is on level ground before loading',
      'Engage parking brake and wheel chocks before loading begins',
      'Check all tie-down straps and equipment before use',
      'Clear the loading area — no bystanders during loading',
      'Verify ramps are secured before driving any vehicle onto the hauler',
    ],
  });

  // ─── Load Order ─────────────────────────────────────────────────────────
  if (vehicleCount > 1) {
    const orderItems: string[] = [
      `You have ${vehicleCount} vehicles — plan your load order before starting`,
      'Load heaviest vehicles first onto the lower deck for stability',
      'Tallest vehicles go to front or rear depending on deck configuration',
    ];
    if (hasInop) {
      orderItems.push('Inoperable vehicles should be positioned at the rear — load LAST');
      orderItems.push('Reserve rear lower position for inoperable units — easiest winch access');
    }
    orderItems.push('Distribute weight evenly side-to-side');
    sections.push({
      title: 'Load Order',
      emoji: '📐',
      items: orderItems,
    });
  }

  // ─── Operable Vehicle Procedures ────────────────────────────────────────
  if (hasOperable) {
    sections.push({
      title: 'Operable Vehicle Loading',
      emoji: '🚗',
      items: [
        'Inspect vehicle exterior before loading — photograph all pre-existing damage',
        'Note and record odometer reading',
        'Check fuel level — should have at least 1/4 tank for moving on/off',
        'Disable any alarms that may trigger during transport',
        'Fold in mirrors before positioning on hauler',
        'Drive slowly onto ramps — no more than walking pace',
        'Turn off engine only after vehicle is fully positioned',
        'Apply parking brake and leave in Park (or in gear for manual)',
      ],
    });
  }

  // ─── Inoperable Procedures ──────────────────────────────────────────────
  if (hasInop) {
    sections.push({
      title: 'Inoperable Vehicle Loading',
      emoji: '🚧',
      urgent: true,
      items: [
        '⚠️ INOPERABLE — requires winch or dolly. Do NOT attempt to drive',
        'Verify vehicle is in neutral before winching',
        'Release parking brake and verify front wheels steer freely',
        'Attach winch to proper tow hooks — NOT bumpers or body panels',
        'Use wheel dollies if vehicle has locked-up brakes or seized wheels',
        'Winch slowly and consistently — no jerking',
        'Have a spotter guiding at all times during inop loading',
        'Photograph the inop vehicle condition extensively before loading',
      ],
    });
  }

  // ─── Tie-Down Points ────────────────────────────────────────────────────
  sections.push({
    title: 'Tie-Down Points by Vehicle Type',
    emoji: '🔗',
    items: [
      'Sedans & Coupes: 4-point tie-down using front and rear strapping loops',
      'SUVs & Trucks: Use factory tie-down hooks under frame — NOT bumper steps',
      'Sports/Low cars: Use axle straps — wheel straps can damage lower body kits',
      'Convertibles: Do NOT strap over the soft top — use frame points only',
      'Electric vehicles: Check manual for approved tow/transport points',
      'Ensure all 4 straps are equally tensioned — no slack',
      'Minimum 4 straps per vehicle — 6 for inoperable or high-value',
      'Re-check tension after first 50 miles of transport',
    ],
  });

  // ─── Cross-Border Checklist ─────────────────────────────────────────────
  if (shipment.is_cross_border) {
    sections.push({
      title: '🇺🇸🇨🇦 Cross-Border Documentation',
      emoji: '🛂',
      urgent: true,
      items: [
        '⚠️ CROSS-BORDER LOAD — Verify all documents before crossing',
        'Original Bill of Lading for each vehicle',
        'Vehicle titles or proof of ownership for each unit',
        'Customs broker contact info available',
        'PAPS/PARS number assigned (US→CA or CA→US)',
        'Verify no restricted/prohibited vehicles (check seizure/lien status)',
        'Driver commercial license valid for international transport',
        'All vehicles must be disclosed on customs manifest',
        'Check vehicle values for duty assessment requirements',
        'Carriers: ensure cargo insurance covers cross-border transport',
      ],
    });
  }

  // ─── Expedited Handling ─────────────────────────────────────────────────
  if (shipment.is_expedited) {
    sections.push({
      title: 'Expedited — Priority Handling',
      emoji: '⚡',
      urgent: true,
      items: [
        '⚡ EXPEDITED LOAD — Customer expects priority handling',
        'Confirm pickup window with dispatcher before arriving',
        'Load as soon as possible upon arrival — no delays',
        'Call dispatcher immediately if pickup is delayed for any reason',
        'Delivery window is firm — communicate any transit delays in real time',
        'Update load status in app after every major milestone',
      ],
    });
  }

  // ─── Delivery & Offload ─────────────────────────────────────────────────
  sections.push({
    title: 'Delivery & Offloading',
    emoji: '🏁',
    items: [
      'Photograph all vehicles again before offloading',
      'Compare delivery condition to pickup photos',
      'Have customer/recipient present for delivery when possible',
      'Do not release vehicle until Bill of Lading is signed',
      'Customer signs delivery BOL — get their printed name',
      'Note any new damage on BOL before releasing vehicle',
      'Collect customer signature in app — tap "Delivery BOL"',
    ],
  });

  return sections;
}

export default function LoadInstructionsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('shipments')
        .select('*, vehicles(*)')
        .eq('id', id)
        .single();
      if (data) setShipment(data);
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!shipment) {
    return (
      <View style={styles.center}>
        <Text style={{ color: colors.textMuted }}>Load not found</Text>
      </View>
    );
  }

  const vehicles = (shipment as any).vehicles ?? [];
  const instructions = buildInstructions(shipment, vehicles);

  return (
    <>
      <Stack.Screen options={{ title: '📋 Load Instructions' }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>📋 Load Instructions</Text>
          <Text style={styles.headerSub}>
            {(shipment as any).tracking_number} · {vehicles.length} vehicle{vehicles.length !== 1 ? 's' : ''}
          </Text>
          {shipment.is_expedited && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>⚡ EXPEDITED</Text>
            </View>
          )}
          {shipment.is_cross_border && (
            <View style={[styles.badge, { backgroundColor: '#7c3aed22', borderColor: '#7c3aed' }]}>
              <Text style={[styles.badgeText, { color: '#a78bfa' }]}>🛂 CROSS-BORDER</Text>
            </View>
          )}
        </View>

        {/* Vehicle Summary */}
        <View style={styles.vehicleSummary}>
          {vehicles.map((v: Vehicle, i: number) => (
            <View key={v.id} style={styles.vehicleRow}>
              <View style={[styles.vehicleNum, { backgroundColor: v.is_operable ? colors.primary + '22' : '#f59e0b22' }]}>
                <Text style={[styles.vehicleNumText, { color: v.is_operable ? colors.primary : '#f59e0b' }]}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.vehicleName}>
                  {[v.year, v.make, v.model].filter(Boolean).join(' ') || 'Vehicle'}
                </Text>
                <Text style={styles.vehicleSub}>
                  {v.is_operable ? '✓ Operable' : '⚠️ INOPERABLE'} · VIN: {v.vin || 'TBD'}
                </Text>
              </View>
              {(v as any).high_value_flag && (
                <Text style={styles.highValueBadge}>💎</Text>
              )}
            </View>
          ))}
        </View>

        {/* Instruction Sections */}
        {instructions.map((section, i) => (
          <View
            key={i}
            style={[styles.section, section.urgent && styles.sectionUrgent]}
          >
            <Text style={[styles.sectionTitle, section.urgent && styles.sectionTitleUrgent]}>
              {section.emoji} {section.title}
            </Text>
            {section.items.map((item, j) => (
              <View key={j} style={styles.item}>
                <Text style={styles.bullet}>•</Text>
                <Text style={[styles.itemText, section.urgent && styles.itemTextUrgent]}>{item}</Text>
              </View>
            ))}
          </View>
        ))}

        <View style={{ height: 32 }} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16 },
  header: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  headerSub: { fontSize: 13, color: colors.textMuted },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#f59e0b22',
    borderWidth: 1,
    borderColor: '#f59e0b',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#f59e0b' },
  vehicleSummary: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  vehicleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  vehicleNum: {
    width: 28, height: 28, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },
  vehicleNumText: { fontSize: 13, fontWeight: '800' },
  vehicleName: { fontSize: 14, fontWeight: '700', color: colors.text },
  vehicleSub: { fontSize: 12, color: colors.textMuted },
  highValueBadge: { fontSize: 18 },
  section: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionUrgent: {
    borderColor: '#f59e0b',
    backgroundColor: '#f59e0b08',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 10,
  },
  sectionTitleUrgent: { color: '#f59e0b' },
  item: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  bullet: { fontSize: 14, color: colors.textMuted, marginTop: 1 },
  itemText: { flex: 1, fontSize: 13, color: colors.textMuted, lineHeight: 20 },
  itemTextUrgent: { color: colors.text },
});
