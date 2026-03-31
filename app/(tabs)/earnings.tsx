import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/colors';

interface WeekSummary {
  weekLabel: string;
  weekStart: string;
  earned: number;
  loadCount: number;
}

interface EarningsSummary {
  totalPaid: number;
  totalPending: number;
  totalAllTime: number;
  paidLoads: number;
  pendingLoads: number;
  weeks: WeekSummary[];
}

function getWeekLabel(date: Date): string {
  const start = new Date(date);
  start.setDate(start.getDate() - start.getDay()); // Sunday
  const end = new Date(start);
  end.setDate(end.getDate() + 6);

  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(start)} – ${fmt(end)}`;
}

function getWeekStart(date: Date): string {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export default function EarningsScreen() {
  const [summary, setSummary] = useState<EarningsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchEarnings() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: loads, error } = await supabase
      .from('shipments')
      .select('id, status, carrier_status, total_price, updated_at, created_at')
      .eq('carrier_user_id', user.id)
      .not('total_price', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(500);

    if (error || !loads) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const paid = loads.filter(l => l.status === 'delivered');
    const pending = loads.filter(l => l.status !== 'delivered' && l.carrier_status === 'accepted');

    const totalPaid = paid.reduce((sum, l) => sum + (parseFloat(l.total_price) || 0), 0);
    const totalPending = pending.reduce((sum, l) => sum + (parseFloat(l.total_price) || 0), 0);

    // Weekly breakdown from delivered loads
    const weekMap = new Map<string, WeekSummary>();
    for (const load of paid) {
      if (!load.total_price) continue;
      const date = new Date(load.updated_at || load.created_at);
      const weekStart = getWeekStart(date);
      const weekLabel = getWeekLabel(date);

      if (!weekMap.has(weekStart)) {
        weekMap.set(weekStart, { weekStart, weekLabel, earned: 0, loadCount: 0 });
      }
      const week = weekMap.get(weekStart)!;
      week.earned += parseFloat(load.total_price) || 0;
      week.loadCount += 1;
    }

    const weeks = Array.from(weekMap.values())
      .sort((a, b) => b.weekStart.localeCompare(a.weekStart))
      .slice(0, 12); // last 12 weeks

    setSummary({
      totalPaid,
      totalPending,
      totalAllTime: totalPaid + totalPending,
      paidLoads: paid.length,
      pendingLoads: pending.length,
      weeks,
    });

    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => { fetchEarnings(); }, []);
  const onRefresh = useCallback(() => { setRefreshing(true); fetchEarnings(); }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!summary) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Could not load earnings data</Text>
      </View>
    );
  }

  const maxWeekEarning = summary.weeks.length > 0 ? Math.max(...summary.weeks.map(w => w.earned)) : 1;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {/* Summary Cards */}
      <View style={styles.summaryGrid}>
        <View style={[styles.summaryCard, { borderColor: colors.success + '55' }]}>
          <Text style={styles.summaryLabel}>Total Paid</Text>
          <Text style={[styles.summaryAmount, { color: colors.success }]}>
            ${summary.totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
          <Text style={styles.summarySubtext}>{summary.paidLoads} delivered loads</Text>
        </View>

        <View style={[styles.summaryCard, { borderColor: colors.accent + '55' }]}>
          <Text style={styles.summaryLabel}>Pending</Text>
          <Text style={[styles.summaryAmount, { color: colors.accent }]}>
            ${summary.totalPending.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
          <Text style={styles.summarySubtext}>{summary.pendingLoads} active loads</Text>
        </View>
      </View>

      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>All-Time Earnings</Text>
        <Text style={styles.totalAmount}>
          ${summary.totalAllTime.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
        <Text style={styles.totalSubtext}>{summary.paidLoads + summary.pendingLoads} total loads</Text>
      </View>

      {/* Weekly Breakdown */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Weekly Breakdown</Text>

        {summary.weeks.length === 0 ? (
          <View style={styles.emptyWeeks}>
            <Text style={styles.emptyText}>No earnings history yet</Text>
          </View>
        ) : (
          summary.weeks.map((week, idx) => {
            const barWidth = (week.earned / maxWeekEarning) * 100;
            return (
              <View key={week.weekStart} style={styles.weekRow}>
                <View style={styles.weekInfo}>
                  <Text style={styles.weekLabel}>{week.weekLabel}</Text>
                  <Text style={styles.weekLoads}>{week.loadCount} load{week.loadCount !== 1 ? 's' : ''}</Text>
                </View>
                <View style={styles.weekBarContainer}>
                  <View style={[styles.weekBar, { width: `${Math.max(barWidth, 4)}%` }]} />
                </View>
                <Text style={styles.weekAmount}>
                  ${week.earned.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </Text>
              </View>
            );
          })
        )}
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: colors.textDim, fontSize: 14 },
  summaryGrid: { flexDirection: 'row', gap: 12, padding: 16, paddingBottom: 0 },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  summaryLabel: { fontSize: 11, fontWeight: '700', color: colors.textDim, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  summaryAmount: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  summarySubtext: { fontSize: 11, color: colors.textDim, marginTop: 4 },
  totalCard: {
    margin: 16,
    marginTop: 12,
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary + '55',
    padding: 20,
    alignItems: 'center',
  },
  totalLabel: { fontSize: 11, fontWeight: '700', color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.5 },
  totalAmount: { fontSize: 36, fontWeight: '900', color: colors.text, letterSpacing: -1, marginTop: 4 },
  totalSubtext: { fontSize: 12, color: colors.textDim, marginTop: 4 },
  section: { padding: 16, paddingTop: 4 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: colors.text, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 10,
  },
  weekInfo: { width: 130 },
  weekLabel: { fontSize: 12, fontWeight: '600', color: colors.text },
  weekLoads: { fontSize: 10, color: colors.textDim, marginTop: 2 },
  weekBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: colors.bgCardAlt,
    borderRadius: 4,
    overflow: 'hidden',
  },
  weekBar: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  weekAmount: { fontSize: 13, fontWeight: '700', color: colors.success, width: 64, textAlign: 'right' },
  emptyWeeks: { paddingVertical: 32, alignItems: 'center' },
  emptyText: { color: colors.textDim, fontSize: 14 },
});
