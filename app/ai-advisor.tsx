import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';

import { DARK_PAGE } from '@/constants/theme';
import {
  ageFromIso,
  parseUserProfile,
  USER_PROFILE_KEY,
  type UserProfileStorage,
  zodiacFromIso,
} from '@/lib/app-storage';
import { readJson } from '@/lib/local-storage';

const GREEN = DARK_PAGE.accent;
const BG = DARK_PAGE.bg;
const CARD_FILL = DARK_PAGE.card;
const BORDER = DARK_PAGE.cardBorder;
const TEXT_PRIMARY = DARK_PAGE.text;
const TEXT_SECONDARY = DARK_PAGE.textSecondary;
const QUICK_PROMPTS = [
  '帮我选一号木杆身',
  '我挥速95适合什么硬度',
  '铁杆和混合杆怎么选',
  '解释挥重D2是什么意思',
];

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

export default function AiAdvisorScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfileStorage | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const raw = await readJson<unknown>(USER_PROFILE_KEY, null);
      if (!active) return;
      const p = raw == null ? null : parseUserProfile(raw);
      setProfile(p);

      const speed = p?.driverSpeed != null ? `挥速 ${p.driverSpeed} mph` : null;
      const handicap = p?.handicap != null ? `差点 ${p.handicap}` : null;
      const height = p?.height != null ? `身高 ${p.height}cm` : null;
      const stats = [speed, handicap, height].filter(Boolean).join('、');
      const statsLine = stats ? `根据你的档案（${stats}），` : '';

      const welcomeContent = `你好！我是你的专属配杆顾问。\n${statsLine}我可以为你推荐适合的球杆型号、杆身搭配和挥重设置。\n\n你想先了解哪方面？`;
      setMessages([{ id: 'welcome', role: 'assistant', content: welcomeContent }]);
    })();
    return () => {
      active = false;
    };
  }, []);

  const systemPrompt = useMemo(() => {
    const p = profile;
    const na = '未填';
    if (!p) {
      return `你是专业高尔夫配杆顾问。用户尚未填写本机档案。用中文亲切专业地回答；每次150字以内；尽量给出具体型号与规格。`;
    }

    const age =
      p.birthday && /^(\d{4})-(\d{2})-(\d{2})$/.test(p.birthday.trim())
        ? ageFromIso(p.birthday)
        : null;
    const zodiac =
      p.birthday && /^(\d{4})-(\d{2})-(\d{2})$/.test(p.birthday.trim())
        ? zodiacFromIso(p.birthday)
        : na;
    const speed = p.driverSpeed != null ? String(p.driverSpeed) : na;
    const handicap = p.handicap != null ? String(p.handicap) : na;
    const height = p.height != null ? String(p.height) : na;
    const weight = p.weight != null ? String(p.weight) : na;
    const hand = p.dominantHand === 'left' ? '左手' : '右手';
    const wrist = p.wristToFloor != null ? String(p.wristToFloor) : na;
    const blood = p.bloodType || na;
    const glove = p.gloveSize || na;
    const finger = p.fingerLength || na;
    const flight = p.ballFlight || na;
    const tempo = p.swingTempo || na;
    const golfAge = p.golfAge || na;
    const courses = p.homeCourses.length ? p.homeCourses.join('、') : na;

    return `你是专业高尔夫配杆顾问。请严格基于以下用户档案给出建议：

用户档案：
- 名字/昵称：${p.name.trim() || na}
- 生日：${p.birthday || na}（年龄约 ${age != null ? `${age}岁` : na}，星座 ${zodiac}）
- 血型：${blood}
- 惯用手：${hand}
- 身高：${height} cm，体重：${weight} kg
- 手腕到地面：${wrist} cm（杆长参考）
- 手套：${glove}，手指长度：${finger}
- WHS 差点：${handicap}，一号木挥速：${speed} mph
- 球龄：${golfAge}，挥杆节奏：${tempo}，惯用球路：${flight}
- 常打球场：${courses}

回答规则：
1. 用中文回答，语气亲切专业
2. 每次回答150字以内
3. 必须给具体型号和规格（杆身型号+硬度+重量）
4. 涉及杆长时参考手腕到地面与身高
5. 涉及握把时参考手套与手指长度
6. 惯用球路是重要配杆依据`;
  }, [profile]);

  async function sendText(raw: string) {
    const content = raw.trim();
    if (!content || loading) return;

    const userMessage: ChatMessage = { id: `u-${Date.now()}`, role: 'user', content };
    const thinkingId = `thinking-${Date.now()}`;
    const nextMessages = [
      ...messages,
      userMessage,
      { id: thinkingId, role: 'assistant' as const, content: '思考中...' },
    ];
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
              m.id === thinkingId ? { ...m, content: '本地开发模式：请在设置页填入API Key' } : m,
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
      const aiText = Array.isArray(json?.content)
        ? json.content.map((c: any) => c?.text || '').join('')
        : '';
      const fallback = '建议先试打 Ping G430 Max + Ventus Blue 6S，再根据弹道和旋转微调。';
      setMessages((prev) =>
        prev.map((m) => (m.id === thinkingId ? { ...m, content: (aiText || fallback).trim() } : m)),
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === thinkingId ? { ...m, content: '网络请求失败，请稍后再试。' } : m,
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSend() {
    await sendText(input);
  }

  const isEmptyChat = messages.length <= 1;

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backText}>返回</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>AI 配杆顾问</Text>
        <View style={s.headerGap} />
      </View>

      <ScrollView
        style={s.chatList}
        contentContainerStyle={s.chatContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {isEmptyChat ? (
          <View style={s.quickWrap}>
            <Text style={s.quickTitle}>快捷提问</Text>
            <View style={s.quickRow}>
              {QUICK_PROMPTS.map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[s.quickChip, loading && s.sendBtnDisabled]}
                  onPress={() => sendText(p)}
                  disabled={loading}
                >
                  <Text style={s.quickChipTxt}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : null}
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <View
              key={msg.id}
              style={[s.bubbleRow, isUser ? s.bubbleRowUser : s.bubbleRowAssistant]}
            >
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
        <TouchableOpacity
          style={[s.sendBtn, loading && s.sendBtnDisabled]}
          onPress={handleSend}
          disabled={loading}
        >
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
    backgroundColor: BG,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: Platform.OS === 'web' ? 44 : 0,
  },
  backBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  backText: { color: TEXT_SECONDARY, fontSize: 13, fontWeight: '700' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: TEXT_PRIMARY },
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
  bubbleAssistant: { backgroundColor: CARD_FILL, borderWidth: 1, borderColor: BORDER },
  bubbleText: { fontSize: 13, color: TEXT_PRIMARY, lineHeight: 20 },
  bubbleTextUser: { color: DARK_PAGE.onAccent },
  inputBar: {
    backgroundColor: CARD_FILL,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: DARK_PAGE.inputBorder,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 40,
    maxHeight: 100,
    color: TEXT_PRIMARY,
    fontSize: 13,
    backgroundColor: DARK_PAGE.inputBg,
  },
  sendBtn: {
    backgroundColor: GREEN,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sendBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.2)' },
  sendBtnText: { color: DARK_PAGE.onAccent, fontSize: 12, fontWeight: '700' },
  quickWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 26,
  },
  quickTitle: { color: TEXT_SECONDARY, fontSize: 13, fontWeight: '700', marginBottom: 10 },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  quickChip: {
    backgroundColor: GREEN,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  quickChipTxt: { color: DARK_PAGE.onAccent, fontSize: 13, fontWeight: '700' },
});
