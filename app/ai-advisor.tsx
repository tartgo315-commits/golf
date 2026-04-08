import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';

import { USER_PROFILE_KEY, type StoredUserProfile } from '@/lib/app-storage';
import { readJson } from '@/lib/local-storage';

const GREEN = '#166534';
const BG = '#f3f4f6';
const WHITE = '#ffffff';
const BORDER = '#e5e7eb';
const TEXT_PRIMARY = '#111827';
const TEXT_SECONDARY = '#6b7280';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

const WELCOME_TEXT = '你好！我是你的专属配杆顾问。你可以问我任何关于球杆选择、杆身搭配、挥重调整的问题。';

export default function AiAdvisorScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<StoredUserProfile | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([{ id: 'welcome', role: 'assistant', content: WELCOME_TEXT }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    const p = readJson<StoredUserProfile | null>(USER_PROFILE_KEY, null);
    setProfile(p);
    if (typeof window !== 'undefined') {
      const key = window.localStorage.getItem('anthropic_key') || '';
      setApiKey(key.trim());
    }
  }, []);

  const systemPrompt = useMemo(() => {
    const swingSpeed = profile?.swingSpeedMph || '未知';
    const handicap = profile?.handicap || '未知';
    const height = profile?.heightCm || '未知';
    return `你是专业高尔夫配杆顾问。用户档案：挥速${swingSpeed}mph，差点${handicap}，身高${height}cm。用中文回答，每次150字以内，给具体型号建议。`;
  }, [profile]);

  async function handleSend() {
    const content = input.trim();
    if (!content || loading) return;

    const userMessage: ChatMessage = { id: `u-${Date.now()}`, role: 'user', content };
    const thinkingId = `thinking-${Date.now()}`;
    const nextMessages = [...messages, userMessage, { id: thinkingId, role: 'assistant' as const, content: '思考中...' }];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    try {
      const localKey = typeof window !== 'undefined' ? (window.localStorage.getItem('anthropic_key') || '').trim() : '';
      const requestKey = localKey || apiKey || process.env.EXPO_PUBLIC_ANTHROPIC_KEY || '';
      if (!requestKey) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === thinkingId
              ? { ...m, content: '请在设置页填入API Key才能使用AI顾问' }
              : m,
          ),
        );
        return;
      }

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': requestKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 300,
          system: systemPrompt,
          messages: nextMessages
            .filter((m) => m.id !== thinkingId)
            .map((m) => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content,
            })),
        }),
      });

      if (!response.ok) {
        throw new Error(`请求失败：${response.status}`);
      }

      const json = await response.json();
      const aiText = Array.isArray(json?.content) ? json.content.map((c: any) => c?.text || '').join('') : '';
      const fallback = '建议先试打 Ping G430 Max + Ventus Blue 6S，再根据弹道和旋转微调。';
      setMessages((prev) =>
        prev.map((m) =>
          m.id === thinkingId
            ? { ...m, content: (aiText || fallback).trim() }
            : m,
        ),
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === thinkingId
            ? { ...m, content: '网络请求失败，请稍后再试。' }
            : m,
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backText}>返回</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>AI 配杆顾问</Text>
        <View style={s.headerGap} />
      </View>

      <ScrollView style={s.chatList} contentContainerStyle={s.chatContent} showsVerticalScrollIndicator={false} bounces={false}>
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <View key={msg.id} style={[s.bubbleRow, isUser ? s.bubbleRowUser : s.bubbleRowAssistant]}>
              <View style={[s.bubble, isUser ? s.bubbleUser : s.bubbleAssistant]}>
                <Text style={[s.bubbleText, isUser && s.bubbleTextUser]}>{msg.content}</Text>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <View style={s.inputBar}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="输入你的问题，例如：我挥速95，选什么一号木？"
          placeholderTextColor={TEXT_SECONDARY}
          style={s.input}
          multiline
        />
        <TouchableOpacity style={[s.sendBtn, loading && s.sendBtnDisabled]} onPress={handleSend} disabled={loading}>
          <Text style={s.sendBtnText}>{loading ? '发送中' : '发送'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    height: Platform.OS === 'web' ? 100 : 56,
    backgroundColor: WHITE,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: Platform.OS === 'web' ? 44 : 0,
  },
  backBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  backText: { color: GREEN, fontSize: 13, fontWeight: '700' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: TEXT_PRIMARY },
  headerGap: { width: 38 },
  chatList: { flex: 1 },
  chatContent: { padding: 16, gap: 8 },
  bubbleRow: { flexDirection: 'row' },
  bubbleRowUser: { justifyContent: 'flex-end' },
  bubbleRowAssistant: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '80%',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  bubbleUser: { backgroundColor: GREEN },
  bubbleAssistant: { backgroundColor: WHITE, borderWidth: 0.5, borderColor: BORDER },
  bubbleText: { fontSize: 13, color: TEXT_PRIMARY, lineHeight: 20 },
  bubbleTextUser: { color: WHITE },
  inputBar: {
    backgroundColor: WHITE,
    borderTopWidth: 0.5,
    borderTopColor: BORDER,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 0.5,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 40,
    maxHeight: 100,
    color: TEXT_PRIMARY,
    fontSize: 13,
  },
  sendBtn: {
    backgroundColor: GREEN,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sendBtnDisabled: { backgroundColor: '#9ca3af' },
  sendBtnText: { color: WHITE, fontSize: 12, fontWeight: '700' },
});
