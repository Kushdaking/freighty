/**
 * Route Matcher — Prevaylos Platform
 * Finds loads on a carrier's route and fires push notifications for new matches.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { supabase } from './supabase';
import type { RouteMatch } from './types';

const DASHBOARD_URL = 'https://app.prevaylos.com';
const NOTIFIED_CACHE_KEY = 'route_match_notified_ids';

// ── Haversine (pure JS) ──────────────────────────────────────────────────────
function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

export function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getDeadheadScore(total: number, max: number): 'green' | 'yellow' | 'red' {
  if (total < 10) return 'green';
  if (total < 30) return 'yellow';
  return 'red';
}

// ── Cache helpers ────────────────────────────────────────────────────────────
async function getNotifiedIds(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(NOTIFIED_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set<string>(parsed);
  } catch {
    return new Set<string>();
  }
}

async function saveNotifiedIds(ids: Set<string>): Promise<void> {
  try {
    // Keep only last 500 to avoid unbounded growth
    const arr = Array.from(ids).slice(-500);
    await AsyncStorage.setItem(NOTIFIED_CACHE_KEY, JSON.stringify(arr));
  } catch {
    // Silently fail — notifications will just send again
  }
}

// ── Push notification helper ─────────────────────────────────────────────────
async function sendPushNotification(title: string, body: string, data?: any): Promise<void> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data ?? {},
        sound: true,
      },
      trigger: null, // Fire immediately
    });
  } catch (err) {
    console.warn('[routeMatcher] Push notification failed:', err);
  }
}

// ── Core matching logic ──────────────────────────────────────────────────────
export interface MatchOptions {
  carrierId: string;
  currentLat: number;
  currentLng: number;
  destinationLat: number;
  destinationLng: number;
  maxDeadheadMiles: number;
}

export async function computeRouteMatches(opts: MatchOptions): Promise<RouteMatch[]> {
  const { currentLat, currentLng, destinationLat, destinationLng, maxDeadheadMiles } = opts;

  // Get available loads
  const { data: loads, error } = await supabase
    .from('shipments')
    .select(`
      id, tracking_number, status, carrier_status,
      origin_city, origin_state, origin_lat, origin_lng,
      destination_city, destination_state, destination_lat, destination_lng,
      total_price, carrier_rate, distance_miles, transport_type,
      scheduled_pickup, estimated_delivery,
      vehicles (id, year, make, model, color, condition, is_operable)
    `)
    .eq('status', 'pending')
    .eq('carrier_status', 'unassigned')
    .not('origin_lat', 'is', null)
    .not('destination_lat', 'is', null);

  if (error || !loads) return [];

  return loads
    .map((load: any) => {
      const pickupDetour = haversine(currentLat, currentLng, load.origin_lat, load.origin_lng);
      const deliveryDetour = haversine(load.destination_lat, load.destination_lng, destinationLat, destinationLng);
      const totalDetour = pickupDetour + deliveryDetour;

      return {
        ...load,
        pickup_detour_miles: Math.round(pickupDetour),
        delivery_detour_miles: Math.round(deliveryDetour),
        total_detour: Math.round(totalDetour),
        deadhead_score: getDeadheadScore(totalDetour, maxDeadheadMiles),
      } as RouteMatch;
    })
    .filter((load: RouteMatch) => load.total_detour <= maxDeadheadMiles)
    .sort((a: RouteMatch, b: RouteMatch) => a.total_detour - b.total_detour);
}

// ── Main exported function ───────────────────────────────────────────────────
export async function matchLoadsForCarrier(carrierId: string): Promise<RouteMatch[]> {
  try {
    // 1. Get carrier profile
    const { data: carrier, error: carrierErr } = await supabase
      .from('carrier_users')
      .select(`
        id, current_lat, current_lng,
        next_available_location_lat, next_available_location_lng,
        next_available_location_city, next_available_location_state,
        max_deadhead_miles, home_base_lat, home_base_lng
      `)
      .eq('id', carrierId)
      .single();

    if (carrierErr || !carrier) {
      console.warn('[routeMatcher] Carrier not found:', carrierId);
      return [];
    }

    // 2. Determine current position — prefer live GPS, fall back to home base
    const currentLat = carrier.current_lat ?? carrier.home_base_lat;
    const currentLng = carrier.current_lng ?? carrier.home_base_lng;

    // 3. Determine destination
    const destinationLat = carrier.next_available_location_lat ?? carrier.home_base_lat;
    const destinationLng = carrier.next_available_location_lng ?? carrier.home_base_lng;

    if (!currentLat || !currentLng || !destinationLat || !destinationLng) {
      console.warn('[routeMatcher] Missing location data for carrier:', carrierId);
      return [];
    }

    const maxDeadheadMiles = carrier.max_deadhead_miles ?? 50;

    // 4. Compute matches
    const matches = await computeRouteMatches({
      carrierId,
      currentLat,
      currentLng,
      destinationLat,
      destinationLng,
      maxDeadheadMiles,
    });

    // 5. Send notifications for new matches
    const notifiedIds = await getNotifiedIds();
    const newMatches = matches.filter((m) => !notifiedIds.has(m.id));

    for (const match of newMatches) {
      const price = match.total_price ?? match.carrier_rate ?? 0;
      const priceStr = price > 0 ? `$${price.toLocaleString()}` : 'price TBD';
      const body = `${match.origin_city}, ${match.origin_state} → ${match.destination_city}, ${match.destination_state} · ${priceStr} · ${match.total_detour} miles off course`;

      await sendPushNotification(
        '💰 Load on your route',
        body,
        { shipmentId: match.id, screen: 'routes' }
      );

      notifiedIds.add(match.id);
    }

    if (newMatches.length > 0) {
      await saveNotifiedIds(notifiedIds);
    }

    return matches;
  } catch (err) {
    console.error('[routeMatcher] Error:', err);
    return [];
  }
}

// ── Trigger after delivery ───────────────────────────────────────────────────
export async function onLoadDelivered(carrierId: string): Promise<void> {
  // Short delay to allow DB to settle
  await new Promise<void>((resolve) => setTimeout(resolve, 2000));

  const matches = await matchLoadsForCarrier(carrierId);

  if (matches.length > 0) {
    const best = matches[0];
    const price = best.total_price ?? best.carrier_rate ?? 0;
    const priceStr = price > 0 ? `$${price.toLocaleString()}` : 'price TBD';

    await sendPushNotification(
      '🎉 Delivery complete! Your next load is ready.',
      `${matches.length} load${matches.length > 1 ? 's' : ''} on your return route. Best: ${best.origin_city} → ${best.destination_city} (${priceStr}, ${best.total_detour} mi off route)`,
      { screen: 'routes' }
    );
  }
}
