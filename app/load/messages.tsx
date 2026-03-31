import { useEffect, useState, useRef } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/colors';
import { sendPushNotification } from '@/lib/notifications';

interface Message {
  id: string;
  sender_type: string;
  sender_name: string | null;
  message: string;
  created_at: string;
}

export default function MessagesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [carrierName, setCarrierName] = useState('Carrier');
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();

      const { data: carrierData } = await supabase
        .from('carrier_users')
        .select('name')
        .eq('auth_user_id', user?.id)
        .single();

      if (carrierData) setCarrierName(carrierData.name);

      const { data } = await supabase
        .from('carrier_messages')
        .select('*')
        .eq('shipment_id', id)
        .order('created_at', { ascending: true });

      if (data) setMessages(data);
      setLoading(false);
    }
    load();

    // Realtime subscription
    const channel = supabase
      .channel(`messages-${id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'carrier_messages',
        filter: `shipment_id=eq.${id}`,
      }, (payload) => {
        setMessages((prev) => [...prev, payload.new as Message]);
        setTimeout(() => listRef.current?.scrollToEnd(), 100);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id]);

  async function sendMessage() {
    if (!text.trim()) return;
    setSending(true);
    const msg = text.trim();
    setText('');

    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('carrier_messages').insert({
      shipment_id: id,
      sender_type: 'carrier',
      sender_name: carrierName,
      message: msg,
    });

    // Notify dispatcher (handled server-side via webhook/realtime)
    await sendPushNotification({
      type: 'message',
      title: `Message from ${carrierName}`,
      body: msg.length > 80 ? msg.slice(0, 80) + '...' : msg,
      data: { shipmentId: id },
    });

    setSending(false);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => listRef.current?.scrollToEnd()}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No messages yet</Text>
          </View>
        }
        renderItem={({ item }) => {
          const isCarrier = item.sender_type === 'carrier';
          return (
            <View style={[styles.bubble, isCarrier ? styles.bubbleOut : styles.bubbleIn]}>
              {!isCarrier && (
                <Text style={styles.senderName}>{item.sender_name ?? 'Dispatcher'}</Text>
              )}
              <Text style={[styles.bubbleText, isCarrier && styles.bubbleTextOut]}>
                {item.message}
              </Text>
              <Text style={styles.bubbleTime}>
                {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          );
        }}
      />

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Message dispatcher..."
          placeholderTextColor={colors.textDim}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
          onPress={sendMessage}
          disabled={!text.trim() || sending}
        >
          <Text style={styles.sendIcon}>➤</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  messageList: { padding: 16, gap: 8, flexGrow: 1 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyText: { color: colors.textMuted, fontSize: 14 },
  bubble: {
    maxWidth: '80%',
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },
  bubbleIn: {
    backgroundColor: colors.bgCard,
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  bubbleOut: {
    backgroundColor: colors.primary,
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  senderName: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  bubbleText: { color: colors.text, fontSize: 15 },
  bubbleTextOut: { color: colors.white },
  bubbleTime: { color: colors.textDim, fontSize: 10, alignSelf: 'flex-end' },
  inputRow: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    backgroundColor: colors.bgCard,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 15,
    maxHeight: 100,
  },
  sendBtn: {
    backgroundColor: colors.primary,
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: colors.textDim },
  sendIcon: { color: colors.white, fontSize: 18 },
});
