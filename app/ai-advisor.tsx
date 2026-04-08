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

  useEffect(() => {
    const p = readJson<StoredUserProfile | null>(USER_PROFILE_KEY, null);
    setProfile(p);
  }, []);

  const systemPrompt = useMemo(() => {
    const swingSpeed = profile?.swingSpeedMph || '未知';
    const handicap = profile?.handicap || '未知';
    const height = profile?.heightCm || '未知';
    return `你是一位专业的高尔夫配杆顾问，精通杆头选择、杆身搭配、挥重计算、握把选择。
用户档案：挥速${swingSpeed}mph，差点${handicap}，身高${height}cm。
用中文回答，专业但易懂，每次回答控制在150字以内，给出具体型号建议。`;
  }, [profile]);

  async function handleSend() {
    const content = input.trim();
    if (!content || loading) return;

    const userMessage: ChatMessage = { id: `u-${Date.now()}`, role: 'user', content };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    try {
      const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY || 'YOUR_ANTHROPIC_API_KEY';
      if (!apiKey || apiKey === 'YOUR_ANTHROPIC_API_KEY') {
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            content: '请先在环境变量 EXPO_PUBLIC_ANTHROPIC_API_KEY 中配置 API Key，配置后即可开始 AI 配杆对话。',
          },
        ]);
        return;
      }

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-5-haiku-latest',
          max_tokens: 300,
          system: systemPrompt,
          messages: nextMessages.map((m) => ({
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
      const fallback = '我建议先从 Ping G430 Max + Ventus Blue 6S 试打起步，再根据弹道和旋转微调。';
      setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: 'assistant', content: aiText || fallback }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: '网络请求出现问题，请稍后重试。你也可以先告诉我你的挥速和差点，我先给你离线建议。',
        },
      ]);
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

      <ScrollView style={s.chatList} contentContainerStyle={s.chatContent}>
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
    height: 56,
    backgroundColor: WHITE,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
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
