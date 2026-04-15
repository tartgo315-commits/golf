import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { parseJsonArray } from '@/lib/local-storage';

const GEMINI_KEY = 'AIzaSyAc_8rBfNpIbh01KpYdAVftZpC8zFLnfOk';
const ZHIPU_KEY = '807ed90dec4c43aaa97fff21aac39c92.4v8DLp7iC0shnhB9';

async function callAI(prompt: string): Promise<{ text: string; source: string }> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    );
    if (res.ok) {
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return { text, source: 'Gemini' };
    }
  } catch {}

  const res2 = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ZHIPU_KEY}`,
    },
    body: JSON.stringify({
      model: 'glm-4-flash',
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res2.ok) throw new Error('两个 API 均请求失败');
  const data2 = await res2.json();
  const text2 = data2?.choices?.[0]?.message?.content;
  if (!text2) throw new Error('返回内容为空');
  return { text: text2, source: '智谱 GLM' };
}

export default function CourseStrategyScreen() {
  const [result, setResult] = useState('');
  const [source, setSource] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasData, setHasData] = useState(true);

  const analyze = useCallback(async () => {
    setLoading(true);
    setResult('');
    setError('');
    setSource('');

    try {
      const raw = await AsyncStorage.getItem('handicapRecords');
      const records = parseJsonArray(raw);

      if (records.length === 0) {
        setHasData(false);
        setLoading(false);
        return;
      }
      setHasData(true);

      const recent = records
        .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 20);

      const avgScore = Math.round(recent.reduce((s: number, r: any) => s + r.adjustedGrossScore, 0) / recent.length);
      const avgPutts = Math.round(recent.filter((r: any) => r.holes === 18).reduce((s: number, r: any) => s + r.totalPutts, 0) / (recent.filter((r: any) => r.holes === 18).length || 1));
      const girRounds = recent.filter((r: any) => r.greensInRegulation != null && r.holes);
      const avgGir = girRounds.length ? Math.round(girRounds.reduce((s: number, r: any) => s + (r.greensInRegulation / r.holes * 100), 0) / girRounds.length) : 0;
      const fwRounds = recent.filter((r: any) => r.fairwaysTotal);
      const avgFw = fwRounds.length ? Math.round(fwRounds.reduce((s: number, r: any) => s + (r.fairwaysHit / r.fairwaysTotal * 100), 0) / fwRounds.length) : 0;
      const lastRound = recent[0];

      const prompt = `你是一位专业高尔夫赛前策略教练，请用中文回答，语言简洁实用，像教练赛前面授一样。

以下是我的数据：
- 近${recent.length}场均杆：${avgScore}杆
- 平均推杆：${avgPutts}次（18洞）
- 平均GIR：${avgGir}%
- 平均球道命中率：${avgFw}%
- 最近一场：${lastRound?.courseName || '--'}，${lastRound?.adjustedGrossScore || '--'}杆

请给出我下一场比赛的策略预案：
1. 🎯 本场核心目标（结合当前水平，定一个合理目标）
2. 🛡️ 短板规避策略（针对弱项，场上具体怎么打）
3. ⚡ 优势发挥方案（强项如何最大化利用）
4. 🧘 心态与节奏管理（关键时刻怎么处理）
5. 💬 一句话核心口诀（简短有力，下场时随时提醒自己）`;

      const { text, source: src } = await callAI(prompt);
      setResult(text);
      setSource(src);
    } catch (e: any) {
      setError(e.message || '分析失败，请检查网络');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void analyze();
    }, [analyze]),
  );

  return (
    <View style={s.root}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backText}>‹ 返回</Text>
        </TouchableOpacity>
        <Text style={s.title}>🧠 下场策略</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
        {loading && (
          <View style={s.loadingBox}>
            <ActivityIndicator color="#a3e635" size="large" />
            <Text style={s.loadingText}>AI 制定策略中...</Text>
          </View>
        )}

        {!hasData && !loading && (
          <View style={s.emptyBox}>
            <Text style={s.emptyText}>请先记录至少 1 场成绩</Text>
          </View>
        )}

        {error !== '' && !loading && (
          <View style={s.errorBox}>
            <Text style={s.errorText}>⚠️ {error}</Text>
          </View>
        )}

        {result !== '' && !loading && (
          <View style={s.resultCard}>
            <Text style={s.sourceTag}>由 {source} 生成</Text>
            <Text style={s.resultText}>{result}</Text>
          </View>
        )}

        {!loading && (
          <TouchableOpacity style={s.reanalyzeBtn} onPress={analyze}>
            <Text style={s.reanalyzeBtnText}>🔄 重新生成策略</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0d1f10' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 16, paddingBottom: 12 },
  backBtn: { width: 60 },
  backText: { fontSize: 16, color: '#a3e635', fontWeight: '600' },
  title: { fontSize: 17, color: '#fff', fontWeight: '700' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  loadingBox: { alignItems: 'center', paddingVertical: 60, gap: 16 },
  loadingText: { color: 'rgba(255,255,255,0.6)', fontSize: 14 },
  emptyBox: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { color: 'rgba(255,255,255,0.4)', fontSize: 14 },
  errorBox: { backgroundColor: 'rgba(255,80,80,0.1)', borderWidth: 1, borderColor: 'rgba(255,80,80,0.3)', borderRadius: 12, padding: 16, marginBottom: 16 },
  errorText: { color: '#ff8080', fontSize: 13 },
  resultCard: { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 16, padding: 18, marginBottom: 16 },
  sourceTag: { fontSize: 10, color: 'rgba(163,230,53,0.7)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.8 },
  resultText: { color: 'rgba(255,255,255,0.88)', fontSize: 14, lineHeight: 24 },
  reanalyzeBtn: { backgroundColor: '#a3e635', borderRadius: 14, height: 50, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  reanalyzeBtnText: { fontSize: 15, fontWeight: '700', color: '#0d1f10' },
});
