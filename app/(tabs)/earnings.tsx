import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator, Dimensions,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import Svg, { Rect, Text as SvgText, G, Line } from 'react-native-svg';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/colors';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface WeekSummary {
  weekLabel: string;
  weekStart: string;
  earned: number;
  loadCount: number;
}

interface MonthSummary {
  totalEarnedThisMonth: number;
  loadsThisMonth: number;
}

interface EarningsSummary {
  totalPaid: number;
  totalPending: number;
  totalAllTime: number;
  paidLoads: number;
  pendingLoads: number;
  weeks: WeekSummary[];
  month: MonthSummary;
  completedLoads: Array<{ id: string; tracking_number: string; total_price: number; origin_city: string; destination_city: string; updated_at: string }>;
}

function getWeekLabel(date: Date): string {
  const start = new Date(date);
  start.setDate(start.getDate() - start.getDay());
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(start)}`;
}

function getWeekStart(date: Date): string {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function isThisMonth(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

interface BarChartProps {
  weeks: WeekSummary[];
}

function WeeklyBarChart({ weeks }: BarChartProps) {
  if (weeks.length === 0) return null;

  // Show last 8 weeks max for readability
  const displayWeeks = weeks.slice(0, 8).reverse();
  const maxEarned = Math.max(...displayWeeks.map(w => w.earned), 1);

  const chartPadding = { left: 48, right: 12, top: 16, bottom: 36 };
  const chartWidth = SCREEN_WIDTH - 32; // card margin
  const chartHeight = 160;
  const plotWidth = chartWidth - chartPadding.left - chartPadding.right;
  const plotHeight = chartHeight - chartPadding.top - chartPadding.bottom;
  const barWidth = Math.min((plotWidth / displayWeeks.length) * 0.6, 32);
  const barSpacing = plotWidth / displayWeeks.length;

  // Y-axis labels
  const ySteps = 4;
  const yLabels = Array.from({ length: ySteps + 1 }, (_, i) => {
    const val = (maxEarned / ySteps) * i;
    return val >= 1000 ? `$${(val / 1000).toFixed(1)}k` : `$${Math.round(val)}`;
  });

  return (
    <Svg width={chartWidth} height={chartHeight}>
      {/* Y-axis grid lines */}
      {yLabels.map((label, i) => {
        const y = chartPadding.top + plotHeight - (plotHeight / ySteps) * i;
        return (
          <G key={i}>
            <Line
              x1={chartPadding.left}
              y1={y}
              x2={chartWidth - chartPadding.right}
              y2={y}
              stroke={colors.border}
              strokeWidth={1}
              strokeDasharray="4 4"
            />
            <SvgText
              x={chartPadding.left - 4}
              y={y + 4}
              textAnchor="end"
              fontSize={9}
              fill={colors.textDim}
            >
              {label}
            </SvgText>
          </G>
        );
      })}

      {/* Bars */}
      {displayWeeks.map((week, i) => {
        const barHeight = (week.earned / maxEarned) * plotHeight;
        const x = chartPadding.left + i * barSpacing + (barSpacing - barWidth) / 2;
        const y = chartPadding.top + plotHeight - barHeight;

        return (
          <G key={week.weekStart}>
            <Rect
              x={x}
              y={y}
              width={barWidth}
              height={Math.max(barHeight, 2)}
              rx={4}
              fill={colors.primary}
              opacity={0.85}
            />
            {/* Week label */}
            <SvgText
              x={x + barWidth / 2}
              y={chartHeight - chartPadding.bottom + 12}
              textAnchor="middle"
              fontSize={9}
              fill={colors.textDim}
            >
              {week.weekLabel}
            </SvgText>
            {/* Load count above bar */}
            {week.loadCount > 0 && (
              <SvgText
                x={x + barWidth / 2}
                y={Math.max(y - 4, chartPadding.top + 8)}
                textAnchor="middle"
                fontSize={9}
                fill={colors.primary}
              >
                {week.loadCount}
              </SvgText>
            )}
          </G>
        );
      })}
    </Svg>
  );
}

export default function EarningsScreen() {
  const [summary, setSummary] = useState<EarningsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchEarnings() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); setRefreshing(false); return; }

    const { data: loads, error } = await supabase
      .from('shipments')
      .select('id, tracking_number, status, carrier_status, total_price, updated_at, created_at, origin_city, destination_city')
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

    // This month
    const monthPaid = paid.filter(l => isThisMonth(l.updated_at || l.created_at));
    const totalEarnedThisMonth = monthPaid.reduce((sum, l) => sum + (parseFloat(l.total_price) || 0), 0);

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
      .slice(0, 12);

    // Completed loads list
    const completedLoads = paid.slice(0, 20).map(l => ({
      id: l.id,
      tracking_number: l.tracking_number,
      total_price: parseFloat(l.total_price) || 0,
      origin_city: l.origin_city,
      destination_city: l.destination_city,
      updated_at: l.updated_at || l.created_at,
    }));

    setSummary({
      totalPaid,
      totalPending,
      totalAllTime: totalPaid + totalPending,
      paidLoads: paid.length,
      pendingLoads: pending.length,
      weeks,
      month: { totalEarnedThisMonth, loadsThisMonth: monthPaid.length },
      completedLoads,
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

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {/* Receipt Scanner CTA */}
      <TouchableOpacity
        style={scannerBtn}
        onPress={() => router.push('/receipt-scanner')}
        activeOpacity={0.8}
      >
        <Text style={{ fontSize: 24 }}>🧾</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#0a0f1a', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 }}>SCAN A RECEIPT</Text>
          <Text style={{ color: 'rgba(10,15,26,0.7)', fontSize: 13, marginTop: 2 }}>Snap fuel, tolls, repairs — AI extracts the details</Text>
        </View>
        <Text style={{ fontSize: 20 }}>→</Text>
      </TouchableOpacity>

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

      {/* This Month card */}
      <View style={[styles.totalCard, { borderColor: colors.success + '44' }]}>
        <Text style={[styles.totalLabel, { color: colors.success }]}>This Month</Text>
        <Text style={styles.totalAmount}>
          ${summary.month.totalEarnedThisMonth.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
        <Text style={styles.totalSubtext}>{summary.month.loadsThisMonth} loads completed this month</Text>
      </View>

      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>All-Time Earnings</Text>
        <Text style={styles.totalAmount}>
          ${summary.totalAllTime.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
        <Text style={styles.totalSubtext}>{summary.paidLoads + summary.pendingLoads} total loads</Text>
      </View>

      {/* Weekly Bar Chart */}
      {summary.weeks.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Weekly Earnings (last 8 weeks)</Text>
          <View style={styles.chartCard}>
            <WeeklyBarChart weeks={summary.weeks} />
          </View>
        </View>
      )}

      {/* Completed Loads List */}
      {summary.completedLoads.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Completed Loads</Text>
          {summary.completedLoads.map(load => (
            <View key={load.id} style={styles.loadRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.loadTracking}>{load.tracking_number}</Text>
                <Text style={styles.loadRoute}>
                  {load.origin_city} → {load.destination_city}
                </Text>
                <Text style={styles.loadDate}>
                  {new Date(load.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
              </View>
              <Text style={styles.loadAmount}>
                ${load.total_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            </View>
          ))}
        </View>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const scannerBtn = {
  flexDirection: 'row' as const, alignItems: 'center' as const, gap: 14,
  backgroundColor: '#C9A84C', borderRadius: 14, padding: 16, margin: 16, marginBottom: 8,
  shadowColor: '#C9A84C', shadowOpacity: 0.35, shadowRadius: 10, elevation: 6,
};

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
  section: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 0 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: colors.text, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  chartCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 8,
    marginBottom: 16,
    overflow: 'hidden',
  },
  loadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: colors.bgCard,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  loadTracking: { fontSize: 12, fontWeight: '800', color: colors.text },
  loadRoute: { fontSize: 11, color: colors.textDim, marginTop: 2 },
  loadDate: { fontSize: 10, color: colors.textDim, marginTop: 2 },
  loadAmount: { fontSize: 16, fontWeight: '900', color: colors.success },
});
