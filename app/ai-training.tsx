import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { equivalent18FromGrossAndHoles } from '@/lib/handicap';
import { parseJsonArray } from '@/lib/local-storage';

const GEMINI_KEY = 'AIzaSyAc_8rBfNpIbh01KpYdAVftZpC8zFLnfOk';
const ZHIPU_KEY = '807ed90dec4c43aaa97fff21aac39c92.4v8DLp7iC0shnhB9';

async function callAI(prompt: string): Promise<{ text: string; source: string }> {
  // 先试 Gemini
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

  // 失败自动切换智谱
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

export default function AITrainingScreen() {
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

      const avgScore = Math.round(
        recent.reduce((s: number, r: any) => {
          const holes = r.holes === 9 ? 9 : 18;
          return s + equivalent18FromGrossAndHoles(Number(r.adjustedGrossScore), holes);
        }, 0) / recent.length,
      );
      const avgPutts = Math.round(recent.filter((r: any) => r.holes === 18).reduce((s: number, r: any) => s + r.totalPutts, 0) / (recent.filter((r: any) => r.holes === 18).length || 1));
      const girRounds = recent.filter((r: any) => r.greensInRegulation != null && r.holes);
      const avgGir = girRounds.length ? Math.round(girRounds.reduce((s: number, r: any) => s + (r.greensInRegulation / r.holes * 100), 0) / girRounds.length) : 0;
      const fwRounds = recent.filter((r: any) => r.fairwaysTotal);
      const avgFw = fwRounds.length ? Math.round(fwRounds.reduce((s: number, r: any) => s + (r.fairwaysHit / r.fairwaysTotal * 100), 0) / fwRounds.length) : 0;
      const bestScore = Math.min(
        ...recent.map((r: any) => {
          const holes = r.holes === 9 ? 9 : 18;
          return equivalent18FromGrossAndHoles(Number(r.adjustedGrossScore), holes);
        }),
      );

      const clubRaw = await AsyncStorage.getItem('savedClubs');
      const clubs = clubRaw ? JSON.parse(clubRaw) : [];
      const clubList = clubs.map((c: any) => c.name || c).join('、') || '暂无球杆库数据';

      const profileRaw =
        (await AsyncStorage.getItem('userProfile')) ||
        (await AsyncStorage.getItem('user_profile'));
      const profile = profileRaw ? JSON.parse(profileRaw) : null;
      const profileText = profile
        ? `身高${profile.heightCm ?? profile.height ?? '--'}cm，体重${profile.weightKg ?? profile.weight ?? '--'}kg，挥速${profile.swingSpeedMph ?? profile.swingSpeed ?? '--'}mph`
        : '暂无档案数据';

      const prompt = `你是一位专业高尔夫教练，请用中文回答，语言简洁实用。

以下是我的数据：
- 近${recent.length}场均杆：${avgScore}杆，最佳${bestScore}杆
- 平均推杆：${avgPutts}次（18洞）
- 平均GIR（果岭命中率）：${avgGir}%
- 平均球道命中率：${avgFw}%
- 球杆库：${clubList}
- 个人档案：${profileText}

请给出：
1. 📌 主要短板分析（最多3项，说明数据依据）
2. 🎯 重点练习方向（每项配具体动作要点）
3. 📅 每周练球计划（频率、时间、各项分配）
4. 🏌️ 最需要重点练习的一支球杆及理由`;

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
        <Text style={s.title}>🎯 练球分析</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
        {loading && (
          <View style={s.loadingBox}>
            <ActivityIndicator color="#a3e635" size="large" />
            <Text style={s.loadingText}>AI 分析中...</Text>
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
            <Text style={s.reanalyzeBtnText}>🔄 重新分析</Text>
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
