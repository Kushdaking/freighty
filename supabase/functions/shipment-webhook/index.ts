/**
 * Supabase Edge Function: shipment-webhook
 *
 * Triggered by a Supabase Database Webhook on the shipments table.
 * When a new shipment is created (INSERT) or when it transitions to 'pending'
 * status with carrier_status = 'unassigned', this function broadcasts a push
 * notification to all active verified carriers.
 *
 * Setup in Supabase Dashboard:
 *   Database → Webhooks → Create new webhook
 *   Table: shipments
 *   Events: INSERT
 *   HTTP Request: POST https://<project>.supabase.co/functions/v1/shipment-webhook
 *   Headers: Authorization: Bearer <service_role_key>
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  schema: string;
  record: Record<string, any>;
  old_record: Record<string, any> | null;
}

serve(async (req) => {
  try {
    const payload: WebhookPayload = await req.json();

    // Only handle INSERT on shipments
    if (payload.type !== 'INSERT' || payload.table !== 'shipments') {
      return new Response(JSON.stringify({ skipped: true }), { status: 200 });
    }

    const shipment = payload.record;

    // Only notify for pending, unassigned loads
    if (shipment.status !== 'pending' || shipment.carrier_status !== 'unassigned') {
      return new Response(JSON.stringify({ skipped: true, reason: 'not a new open load' }), { status: 200 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get all active, verified carriers with push tokens
    const { data: carriers, error: carrierErr } = await supabase
      .from('carrier_users')
      .select('id, auth_user_id, name')
      .eq('is_active', true)
      .eq('is_verified', true);

    if (carrierErr || !carriers || carriers.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: 'no carriers' }), { status: 200 });
    }

    const authUserIds = carriers.map((c: any) => c.auth_user_id).filter(Boolean);

    if (authUserIds.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: 'no auth ids' }), { status: 200 });
    }

    // Get push tokens
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('endpoint')
      .in('user_id', authUserIds);

    const tokens = (subs ?? []).map((s: any) => s.endpoint).filter(Boolean);
    if (tokens.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: 'no push tokens' }), { status: 200 });
    }

    // Build notification
    const origin = `${shipment.origin_city}, ${shipment.origin_state}`;
    const destination = `${shipment.destination_city}, ${shipment.destination_state}`;
    const rate = shipment.total_price
      ? `$${parseFloat(shipment.total_price).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
      : 'Rate TBD';

    const notifTitle = '🚛 New Load Available';
    const notifBody = `${origin} → ${destination} · ${rate}`;

    const messages = tokens.map(token => ({
      to: token,
      title: notifTitle,
      body: notifBody,
      data: {
        type: 'new_load',
        shipment_id: shipment.id,
        tracking_number: shipment.tracking_number,
        origin,
        destination,
        rate: shipment.total_price,
      },
      sound: 'default',
      channelId: 'loads',
      priority: 'high',
    }));

    // Batch sends (Expo allows max 100 per request)
    let sent = 0;
    for (let i = 0; i < messages.length; i += 100) {
      const chunk = messages.slice(i, i + 100);
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(chunk),
      });
      if (res.ok) sent += chunk.length;
    }

    // Log the notification event
    await supabase.from('shipment_events').insert({
      shipment_id: shipment.id,
      event_type: 'push_sent',
      description: `New load push notification sent to ${sent} carrier(s)`,
      event_time: new Date().toISOString(),
    }).catch(() => {}); // Non-fatal

    console.log(`Shipment ${shipment.id}: push sent to ${sent}/${tokens.length} carriers`);

    return new Response(JSON.stringify({
      success: true,
      shipment_id: shipment.id,
      carriers_notified: sent,
      tokens_total: tokens.length,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('shipment-webhook error:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
