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

export default function AiAdvisorScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<StoredUserProfile | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const p = readJson<StoredUserProfile | null>(USER_PROFILE_KEY, null);
    setProfile(p);

    const speed = p?.swingSpeedMph ? `挥速 ${p.swingSpeedMph} mph` : null;
    const handicap = p?.handicap ? `差点 ${p.handicap}` : null;
    const height = p?.heightCm ? `身高 ${p.heightCm}cm` : null;
    const stats = [speed, handicap, height].filter(Boolean).join('、');
    const statsLine = stats ? `根据你的档案（${stats}），` : '';

    const welcomeContent = `你好！我是你的专属配杆顾问。\n${statsLine}我可以为你推荐适合的球杆型号、杆身搭配和挥重设置。\n\n你想先了解哪方面？`;
    setMessages([{ id: 'welcome', role: 'assistant', content: welcomeContent }]);

  }, []);

  const systemPrompt = useMemo(() => {
    const speed = profile?.swingSpeedMph || '未知';
    const handicap = profile?.handicap || '未知';
    const height = profile?.heightCm || '未知';
    const age = profile?.age || '未知';
    const weight = profile?.weightKg || '未知';
    const hand = profile?.dominantHand === 'left' ? '左手' : '右手';
    const wrist = profile?.wristToFloorCm || '未知';
    const grip = profile?.handCircumferenceCm || '未知';
    const flight = profile?.ballFlight === 'high' ? '高弹道' : profile?.ballFlight === 'low' ? '低弹道' : '中弹道';
    const shape = profile?.shotShape === 'slice' ? '右曲（slice）'
      : profile?.shotShape === 'fade' ? '轻切（fade）'
        : profile?.shotShape === 'draw' ? '轻抓（draw）'
          : profile?.shotShape === 'hook' ? '左曲（hook）'
            : '直球';
    const tempo = profile?.swingTempo === 'fast' ? '快节奏' : profile?.swingTempo === 'slow' ? '慢节奏' : '中节奏';
    const years = profile?.yearsPlaying || '未知';
    const budget = profile?.budgetPerClub ? `¥${profile.budgetPerClub}` : '未设定';
    const brand = profile?.currentBrand || '未知';

    return `你是专业高尔夫配杆顾问。请严格基于以下用户档案给出建议，不要忽略任何字段：

用户档案：
- 挥速：${speed}mph
- 差点：${handicap}
- 身高：${height}cm，体重：${weight}kg，年龄：${age}岁
- 惯用手：${hand}
- 腕底距离：${wrist}cm（影响杆长）
- 手掌围：${grip}cm（影响握把尺寸）
- 典型弹道：${flight}
- 球路偏差：${shape}
- 挥杆节奏：${tempo}
- 打球年限：${years}年
- 单支预算：${budget}
- 目前使用品牌：${brand}

回答规则：
1. 用中文回答，语气亲切专业
2. 每次回答150字以内
3. 必须给具体型号和规格（杆身型号+硬度+重量）
4. 涉及杆长时参考腕底距离
5. 涉及握把时参考手掌围
6. 球路偏差是首要配杆依据
7. 预算内优先推荐，超预算时说明理由`;
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
      const isWeb = typeof window !== 'undefined';
      const localKey = isWeb ? (window.localStorage.getItem('anthropic_key') || '').trim() : '';

      // 判断是否在 Vercel 环境（有代理接口）
      const useProxy = isWeb && window.location.hostname !== 'localhost';
      const endpoint = useProxy ? '/api/chat' : 'https://api.anthropic.com/v1/messages';

      const headers: Record<string, string> = {
        'content-type': 'application/json',
      };

      // 本地开发时仍需要 Key，Vercel 上不需要
      if (!useProxy) {
        const requestKey = localKey || process.env.EXPO_PUBLIC_ANTHROPIC_KEY || '';
        if (!requestKey) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === thinkingId
                ? { ...m, content: '本地开发模式：请在设置页填入API Key' }
                : m,
            ),
          );
          return;
        }
        headers['x-api-key'] = requestKey;
        headers['anthropic-version'] = '2023-06-01';
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
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
