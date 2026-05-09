import { GOLF } from '@/constants/golfTheme';
import { loadThread, markThreadRead, sendMessage, type ChatMessage } from '@/lib/chatApi';
import { supabase } from '@/lib/supabase';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

export default function ChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ friendId?: string; friendName?: string }>();
  const friendId = String(params.friendId ?? '');
  const friendName =
    typeof params.friendName === 'string'
      ? params.friendName
      : Array.isArray(params.friendName)
        ? params.friendName[0]
        : '';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [myId, setMyId] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  useEffect(() => {
    if (!friendId) return;
    let cancelled = false;
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!cancelled && user) setMyId(user.id);
    });
    void loadThread(friendId)
      .then((msgs) => {
        if (!cancelled) {
          setMessages(msgs);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    void markThreadRead(friendId).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [friendId]);

  useEffect(() => {
    if (!friendId || !myId) return;
    const channel = supabase
      .channel(`chat:${myId}:${friendId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${myId}`,
        },
        (payload) => {
          const m = payload.new as Record<string, unknown>;
          if (m.sender_id !== friendId) return;
          const row = {
            id: String(m.id),
            senderId: String(m.sender_id),
            receiverId: String(m.receiver_id),
            content: String(m.content ?? ''),
            read: Boolean(m.read),
            createdAt: String(m.created_at ?? ''),
          };
          setMessages((prev) => {
            if (prev.some((x) => x.id === row.id)) return prev;
            return [...prev, row];
          });
          void markThreadRead(friendId).catch(() => {});
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [friendId, myId]);

  useEffect(() => {
    if (messages.length > 0) {
      const t = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
      return () => clearTimeout(t);
    }
  }, [messages]);

  async function onSend() {
    const text = input.trim();
    if (!text || sending || !friendId) return;
    setSending(true);
    setInput('');
    try {
      await sendMessage(friendId, text);
      setMessages((prev) => [
        ...prev,
        {
          id: `local-${Date.now()}`,
          senderId: myId,
          receiverId: friendId,
          content: text,
          read: false,
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch {
      setInput(text);
    } finally {
      setSending(false);
    }
  }

  function renderItem({ item }: { item: ChatMessage }) {
    const isMine = item.senderId === myId;
    return (
      <View style={[s.bubble, isMine ? s.bubbleMine : s.bubbleTheirs]}>
        <Text style={[s.bubbleTxt, isMine ? s.bubbleTxtMine : s.bubbleTxtTheirs]}>{item.content}</Text>
        <Text style={[s.timeLabel, isMine && s.timeLabelMine]}>
          {new Date(item.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={s.back}>‹ 返回</Text>
        </Pressable>
        <Text style={s.title}>{friendName || '球友'}</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={GOLF.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={renderItem}
          contentContainerStyle={s.list}
          ListEmptyComponent={<Text style={s.empty}>暂无消息，发送第一条吧 👋</Text>}
        />
      )}

      <View style={s.inputRow}>
        <TextInput
          style={s.input}
          value={input}
          onChangeText={setInput}
          placeholder="发消息…"
          placeholderTextColor={GOLF.muted}
          multiline
          maxLength={500}
          onSubmitEditing={() => void onSend()}
          blurOnSubmit={false}
        />
        <Pressable
          style={[s.sendBtn, (!input.trim() || sending) && { opacity: 0.4 }]}
          onPress={() => void onSend()}
          disabled={!input.trim() || sending}
        >
          <Text style={s.sendTxt}>发送</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: GOLF.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  back: { color: GOLF.accent, fontSize: 16, fontWeight: '800' },
  title: { color: GOLF.text, fontSize: 16, fontWeight: '900' },
  list: { padding: 16, gap: 8, paddingBottom: 8 },
  empty: { color: GOLF.muted, textAlign: 'center', marginTop: 40 },
  bubble: {
    maxWidth: '75%',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginVertical: 2,
  },
  bubbleMine: {
    alignSelf: 'flex-end',
    backgroundColor: GOLF.accent,
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    alignSelf: 'flex-start',
    backgroundColor: GOLF.bgCard,
    borderBottomLeftRadius: 4,
  },
  bubbleTxt: { fontSize: 14, lineHeight: 20 },
  bubbleTxtMine: { color: '#07120b', fontWeight: '700' },
  bubbleTxtTheirs: { color: GOLF.text },
  timeLabel: { fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2, alignSelf: 'flex-end' },
  timeLabelMine: { color: 'rgba(0,0,0,0.4)' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    backgroundColor: GOLF.bg,
  },
  input: {
    flex: 1,
    backgroundColor: GOLF.bgCard,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    color: GOLF.text,
    fontSize: 14,
    maxHeight: 100,
  },
  sendBtn: {
    backgroundColor: GOLF.accent,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sendTxt: { color: '#07120b', fontWeight: '900', fontSize: 14 },
});
