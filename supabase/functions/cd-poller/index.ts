/**
 * Central Dispatch Poller — Prevaylos Platform
 *
 * Edge Function that polls Central Dispatch listings API for new available loads.
 * Triggered externally (cron job or webhook) since Supabase Edge Functions
 * don't have built-in scheduling.
 *
 * Cron trigger example (run every 15 minutes via crontab):
 *   CRON: 15min interval
 *   curl -X POST https://ruyulhpkuxcjoylxrfyz.supabase.co/functions/v1/cd-poller
 *     -H "Authorization: Bearer SERVICE_ROLE_KEY"
 *
 * Required env vars:
 *   SUPABASE_URL          — auto-injected by Supabase
 *   SUPABASE_SERVICE_ROLE_KEY — auto-injected by Supabase
 *   CD_CLIENT_ID          — Central Dispatch API client ID (pending Kenny's credentials)
 *   CD_CLIENT_SECRET      — Central Dispatch API client secret (pending)
 *   CD_API_BASE_URL       — Defaults to https://api.centraldispatch.com/v1
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── Haversine (pure JS) ──────────────────────────────────────────────────────
function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
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

function getDeadheadScore(total: number, max: number): string {
  if (total < 10) return 'green';
  if (total < 30) return 'yellow';
  if (total < max) return 'red';
  return 'red';
}

// ── CD API client ────────────────────────────────────────────────────────────
const CD_API_BASE = Deno.env.get('CD_API_BASE_URL') ?? 'https://api.centraldispatch.com/v1';
const CD_CLIENT_ID = Deno.env.get('CD_CLIENT_ID') ?? 'PLACEHOLDER_CD_CLIENT_ID';
const CD_CLIENT_SECRET = Deno.env.get('CD_CLIENT_SECRET') ?? 'PLACEHOLDER_CD_CLIENT_SECRET';

interface CDListing {
  id: string;
  origin_city: string;
  origin_state: string;
  origin_zip: string;
  origin_lat?: number;
  origin_lng?: number;
  destination_city: string;
  destination_state: string;
  destination_zip: string;
  destination_lat?: number;
  destination_lng?: number;
  price: number;
  distance_miles?: number;
  transport_type?: string;
  vehicles: Array<{
    vin?: string;
    year?: number;
    make?: string;
    model?: string;
    condition?: string;
    is_operable?: boolean;
  }>;
  pickup_date?: string;
  delivery_date?: string;
  broker_name?: string;
  broker_id?: string;
}

async function fetchCDToken(): Promise<string | null> {
  // Placeholder — replace with real OAuth2 flow when CD creds arrive
  if (CD_CLIENT_ID === 'PLACEHOLDER_CD_CLIENT_ID') {
    console.log('[cd-poller] CD credentials not set — skipping real API call');
    return null;
  }

  try {
    const res = await fetch(`${CD_API_BASE}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: CD_CLIENT_ID,
        client_secret: CD_CLIENT_SECRET,
      }),
    });
    const data = await res.json();
    return data.access_token ?? null;
  } catch (e) {
    console.error('[cd-poller] Failed to get CD token:', e);
    return null;
  }
}

async function fetchCDListings(token: string): Promise<CDListing[]> {
  try {
    const res = await fetch(`${CD_API_BASE}/listings?status=available&limit=100`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });
    if (!res.ok) {
      console.error('[cd-poller] CD API error:', res.status, await res.text());
      return [];
    }
    const data = await res.json();
    return data.listings ?? data.items ?? data ?? [];
  } catch (e) {
    console.error('[cd-poller] Failed to fetch CD listings:', e);
    return [];
  }
}

// ── Simulate listings for testing (when CD creds not set) ───────────────────
function getMockListings(): CDListing[] {
  return [
    {
      id: `cd-mock-${Date.now()}-1`,
      origin_city: 'Los Angeles', origin_state: 'CA', origin_zip: '90001',
      origin_lat: 34.0522, origin_lng: -118.2437,
      destination_city: 'Phoenix', destination_state: 'AZ', destination_zip: '85001',
      destination_lat: 33.4484, destination_lng: -112.0740,
      price: 850, distance_miles: 372, transport_type: 'open',
      vehicles: [{ year: 2022, make: 'Toyota', model: 'Camry', condition: 'excellent', is_operable: true }],
      pickup_date: new Date().toISOString(),
    },
    {
      id: `cd-mock-${Date.now()}-2`,
      origin_city: 'Dallas', origin_state: 'TX', origin_zip: '75201',
      origin_lat: 32.7767, origin_lng: -96.7970,
      destination_city: 'Atlanta', destination_state: 'GA', destination_zip: '30301',
      destination_lat: 33.7490, destination_lng: -84.3880,
      price: 1200, distance_miles: 781, transport_type: 'enclosed',
      vehicles: [{ year: 2023, make: 'BMW', model: '3 Series', condition: 'excellent', is_operable: true }],
    },
  ];
}

// ── Route matching for active carriers ──────────────────────────────────────
async function triggerRouteMatchingForCarriers(
  supabase: any,
  shipmentId: string,
  originLat: number | null,
  originLng: number | null,
  destLat: number | null,
  destLng: number | null
): Promise<void> {
  if (!originLat || !destLat) return;

  // Get active carriers with a next available location set
  const { data: carriers } = await supabase
    .from('carrier_users')
    .select('id, current_lat, current_lng, next_available_location_lat, next_available_location_lng, max_deadhead_miles, home_base_lat, home_base_lng')
    .eq('is_active', true)
    .not('next_available_location_lat', 'is', null);

  if (!carriers?.length) return;

  const matches: Array<{ carrier_id: string; detour: number; score: string }> = [];

  for (const carrier of carriers) {
    const cLat = carrier.current_lat ?? carrier.home_base_lat;
    const cLng = carrier.current_lng ?? carrier.home_base_lng;
    const dLat = carrier.next_available_location_lat;
    const dLng = carrier.next_available_location_lng;
    const maxMiles = carrier.max_deadhead_miles ?? 50;

    if (!cLat || !cLng || !dLat || !dLng) continue;

    const pickupDetour = haversine(cLat, cLng, originLat, originLng!);
    const deliveryDetour = haversine(destLat!, destLng!, dLat, dLng);
    const total = pickupDetour + deliveryDetour;

    if (total <= maxMiles) {
      matches.push({
        carrier_id: carrier.id,
        detour: Math.round(total),
        score: getDeadheadScore(total, maxMiles),
      });
    }
  }

  if (matches.length > 0) {
    console.log(`[cd-poller] Shipment ${shipmentId} matches ${matches.length} active carriers`);
    // In production, you'd push notifications here via Expo Push API
    // or write to a route_match_notifications table
    await supabase.from('route_match_log').upsert(
      matches.map(m => ({
        carrier_id: m.carrier_id,
        shipment_id: shipmentId,
        total_detour: m.detour,
        deadhead_score: m.score,
        created_at: new Date().toISOString(),
      })),
      { onConflict: 'carrier_id,shipment_id', ignoreDuplicates: true }
    ).catch(() => { /* table may not exist yet */ });
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const results = {
    checked: 0,
    new: 0,
    skipped: 0,
    errors: 0,
    timestamp: new Date().toISOString(),
    mode: 'live' as 'live' | 'mock',
  };

  try {
    // Fetch CD token (or use mock data)
    const token = await fetchCDToken();
    let listings: CDListing[];

    if (!token) {
      // Use mock data when credentials not set
      listings = getMockListings();
      results.mode = 'mock';
      console.log('[cd-poller] Running in mock mode — no CD credentials set');
    } else {
      listings = await fetchCDListings(token);
      results.mode = 'live';
    }

    results.checked = listings.length;

    // Process each listing
    for (const listing of listings) {
      try {
        // Check if we already have this CD external_id
        const { data: existing } = await supabaseClient
          .from('marketplace_listings')
          .select('id, shipment_id')
          .eq('external_id', listing.id)
          .eq('platform', 'central_dispatch')
          .maybeSingle();

        if (existing) {
          results.skipped++;
          continue;
        }

        // Build tracking number
        const trackingNum = `CD-${listing.id.slice(0, 8).toUpperCase()}`;

        // Create shipment record
        const { data: shipment, error: shipmentError } = await supabaseClient
          .from('shipments')
          .insert({
            tracking_number: trackingNum,
            status: 'pending',
            carrier_status: 'unassigned',
            origin_address: `${listing.origin_city}, ${listing.origin_state}`,
            origin_city: listing.origin_city,
            origin_state: listing.origin_state,
            origin_zip: listing.origin_zip,
            origin_lat: listing.origin_lat ?? null,
            origin_lng: listing.origin_lng ?? null,
            destination_address: `${listing.destination_city}, ${listing.destination_state}`,
            destination_city: listing.destination_city,
            destination_state: listing.destination_state,
            destination_zip: listing.destination_zip,
            destination_lat: listing.destination_lat ?? null,
            destination_lng: listing.destination_lng ?? null,
            total_price: listing.price,
            distance_miles: listing.distance_miles ?? null,
            transport_type: listing.transport_type ?? 'open',
            is_expedited: false,
            is_cross_border: false,
            scheduled_pickup: listing.pickup_date ?? null,
            estimated_delivery: listing.delivery_date ?? null,
            carrier_name: listing.broker_name ?? null,
            notes: `Imported from Central Dispatch. Broker ID: ${listing.broker_id ?? 'N/A'}`,
          })
          .select('id, origin_lat, origin_lng, destination_lat, destination_lng')
          .single();

        if (shipmentError || !shipment) {
          console.error('[cd-poller] Failed to create shipment:', shipmentError?.message);
          results.errors++;
          continue;
        }

        // Create vehicle records
        if (listing.vehicles?.length) {
          await supabaseClient.from('vehicles').insert(
            listing.vehicles.map(v => ({
              shipment_id: shipment.id,
              vin: v.vin ?? `CD-VIN-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
              year: v.year ?? null,
              make: v.make ?? null,
              model: v.model ?? null,
              condition: v.condition ?? 'unknown',
              is_operable: v.is_operable ?? true,
              status: 'pending',
            }))
          );
        }

        // Record in marketplace_listings
        await supabaseClient.from('marketplace_listings').insert({
          shipment_id: shipment.id,
          platform: 'central_dispatch',
          external_id: listing.id,
          status: 'active',
          listed_at: new Date().toISOString(),
          synced_at: new Date().toISOString(),
          external_data: listing,
        });

        results.new++;

        // Trigger route matching for active carriers
        await triggerRouteMatchingForCarriers(
          supabaseClient,
          shipment.id,
          shipment.origin_lat,
          shipment.origin_lng,
          shipment.destination_lat,
          shipment.destination_lng
        );

      } catch (listingErr) {
        console.error('[cd-poller] Error processing listing:', listing.id, listingErr);
        results.errors++;
      }
    }

    console.log('[cd-poller] Done:', results);

    return new Response(JSON.stringify({ success: true, ...results }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('[cd-poller] Fatal error:', err);
    return new Response(
      JSON.stringify({ success: false, error: err.message ?? 'Internal error', ...results }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
