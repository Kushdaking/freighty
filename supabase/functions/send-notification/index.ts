import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface NotificationPayload {
  type: 'new_load' | 'load_update' | 'message' | 'payment' | 'verification';
  title: string;
  body: string;
  carrierUserId?: string;
  data?: Record<string, any>;
}

serve(async (req) => {
  try {
    const payload: NotificationPayload = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get push tokens for the target carrier(s)
    let userIds: string[] = [];

    if (payload.carrierUserId) {
      // Get auth_user_id from carrier_users
      const { data } = await supabase
        .from('carrier_users')
        .select('auth_user_id')
        .eq('id', payload.carrierUserId)
        .single();
      if (data?.auth_user_id) userIds = [data.auth_user_id];
    } else if (payload.type === 'new_load') {
      // Broadcast to all active verified carriers
      const { data } = await supabase
        .from('carrier_users')
        .select('auth_user_id')
        .eq('is_active', true)
        .eq('is_verified', true);
      userIds = (data ?? []).map((c: any) => c.auth_user_id).filter(Boolean);
    }

    if (userIds.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
    }

    // Get push tokens
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('endpoint')
      .in('user_id', userIds);

    const tokens = (subs ?? []).map((s: any) => s.endpoint).filter(Boolean);
    if (tokens.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: 'no tokens' }), { status: 200 });
    }

    // Send via Expo Push API (batched, max 100 per request)
    const messages = tokens.map(token => ({
      to: token,
      title: payload.title,
      body: payload.body,
      data: { type: payload.type, ...(payload.data ?? {}) },
      sound: 'default',
      channelId: payload.type === 'new_load' ? 'loads'
        : payload.type === 'message' ? 'messages'
        : 'status',
      priority: payload.type === 'new_load' ? 'high' : 'normal',
    }));

    const chunks = [];
    for (let i = 0; i < messages.length; i += 100) {
      chunks.push(messages.slice(i, i + 100));
    }

    let sent = 0;
    for (const chunk of chunks) {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(chunk),
      });
      if (res.ok) sent += chunk.length;
    }

    return new Response(JSON.stringify({ sent }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
