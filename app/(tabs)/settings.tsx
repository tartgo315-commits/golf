import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { USER_PROFILE_KEY, type StoredUserProfile } from '@/lib/app-storage';
import { readJson, writeJson } from '@/lib/local-storage';

const WHITE = '#ffffff';
const BG = '#f3f4f6';
const BORDER = '#e5e7eb';
const GREEN = '#166534';
const TEXT_PRIMARY = '#111827';
const TEXT_SECONDARY = '#6b7280';

export default function SettingsScreen() {
  const [swingSpeedMph, setSwingSpeedMph] = useState('');
  const [handicap, setHandicap] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [age, setAge] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [dominantHand, setDominantHand] = useState<'left' | 'right'>('right');
  const [wristToFloorCm, setWristToFloorCm] = useState('');
  const [handCircumferenceCm, setHandCircumferenceCm] = useState('');
  const [ballFlight, setBallFlight] = useState<StoredUserProfile['ballFlight'] | ''>('');
  const [shotShape, setShotShape] = useState<StoredUserProfile['shotShape'] | ''>('');
  const [swingTempo, setSwingTempo] = useState<StoredUserProfile['swingTempo'] | ''>('');
  const [yearsPlaying, setYearsPlaying] = useState('');
  const [budgetPerClub, setBudgetPerClub] = useState('');
  const [currentBrand, setCurrentBrand] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [apiSaveMessage, setApiSaveMessage] = useState('');

  useFocusEffect(
    useCallback(() => {
      const p = readJson<StoredUserProfile | null>(USER_PROFILE_KEY, null);
      if (p) {
        setSwingSpeedMph(p.swingSpeedMph ?? '');
        setHandicap(p.handicap ?? '');
        setHeightCm(p.heightCm ?? '');
        setAge(p.age ?? '');
        setWeightKg(p.weightKg ?? '');
        setDominantHand(p.dominantHand ?? 'right');
        setWristToFloorCm(p.wristToFloorCm ?? '');
        setHandCircumferenceCm(p.handCircumferenceCm ?? '');
        setBallFlight(p.ballFlight ?? '');
        setShotShape(p.shotShape ?? '');
        setSwingTempo(p.swingTempo ?? '');
        setYearsPlaying(p.yearsPlaying ?? '');
        setBudgetPerClub(p.budgetPerClub ?? '');
        setCurrentBrand(p.currentBrand ?? '');
      }
      if (typeof window !== 'undefined') {
        const key = window.localStorage.getItem('anthropic_key') || '';
        setAnthropicKey(key);
      }
    }, []),
  );

  function onSaveProfile() {
    const profile: StoredUserProfile = {
      swingSpeedMph: swingSpeedMph.trim(),
      handicap: handicap.trim(),
      heightCm: heightCm.trim(),
      age: age.trim(),
      weightKg: weightKg.trim(),
      dominantHand,
      wristToFloorCm: wristToFloorCm.trim(),
      handCircumferenceCm: handCircumferenceCm.trim(),
      ballFlight: ballFlight || undefined,
      shotShape: shotShape || undefined,
      swingTempo: swingTempo || undefined,
      yearsPlaying: yearsPlaying.trim(),
      budgetPerClub: budgetPerClub.trim(),
      currentBrand: currentBrand.trim(),
      updatedAt: new Date().toISOString(),
    };
    const ok = writeJson(USER_PROFILE_KEY, profile);
    const readBack = readJson<StoredUserProfile | null>(USER_PROFILE_KEY, null);
    if (ok && readBack && readBack.updatedAt === profile.updatedAt) {
      setSaveMessage(`已保存 ${new Date().toLocaleTimeString()}`);
    } else {
      setSaveMessage('保存失败，请重试');
    }
  }

  function onSaveApiKey() {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem('anthropic_key', anthropicKey.trim());
      setApiSaveMessage(`已保存 ${new Date().toLocaleTimeString()}`);
    } catch {
      setApiSaveMessage('保存失败，请重试');
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} bounces={false}>
      <Text style={styles.title}>个人档案</Text>

      <View style={styles.card}>
        <Text style={styles.fieldLabel}>挥速（mph）</Text>
        <TextInput value={swingSpeedMph} onChangeText={setSwingSpeedMph} style={styles.input} placeholder="例如 92" keyboardType="decimal-pad" />

        <Text style={styles.fieldLabel}>差点</Text>
        <TextInput value={handicap} onChangeText={setHandicap} style={styles.input} placeholder="例如 15" keyboardType="decimal-pad" />

        <Text style={styles.fieldLabel}>身高（cm）</Text>
        <TextInput value={heightCm} onChangeText={setHeightCm} style={styles.input} placeholder="例如 175" keyboardType="decimal-pad" />

        <Text style={styles.fieldLabel}>年龄</Text>
        <TextInput value={age} onChangeText={setAge} style={styles.input} placeholder="例如 34" keyboardType="number-pad" />

        <Text style={styles.fieldLabel}>体重（kg）</Text>
        <TextInput value={weightKg} onChangeText={setWeightKg} style={styles.input} placeholder="例如 72" keyboardType="decimal-pad" />

        <Text style={styles.fieldLabel}>惯用手</Text>
        <View style={styles.handRow}>
          <Pressable onPress={() => setDominantHand('left')} style={[styles.handChip, dominantHand === 'left' && styles.handChipOn]}>
            <Text style={[styles.handTxt, dominantHand === 'left' && styles.handTxtOn]}>左手</Text>
          </Pressable>
          <Pressable onPress={() => setDominantHand('right')} style={[styles.handChip, dominantHand === 'right' && styles.handChipOn]}>
            <Text style={[styles.handTxt, dominantHand === 'right' && styles.handTxtOn]}>右手</Text>
          </Pressable>
        </View>

        <Text style={styles.fieldLabel}>腕底距离（cm）</Text>
        <TextInput value={wristToFloorCm} onChangeText={setWristToFloorCm} style={styles.input} placeholder="例如 81" keyboardType="decimal-pad" />

        <Text style={styles.fieldLabel}>手掌围（cm）</Text>
        <TextInput value={handCircumferenceCm} onChangeText={setHandCircumferenceCm} style={styles.input} placeholder="例如 19" keyboardType="decimal-pad" />

        <Text style={styles.fieldLabel}>典型弹道</Text>
        <View style={styles.handRow}>
          <Pressable onPress={() => setBallFlight('high')} style={[styles.handChip, ballFlight === 'high' && styles.handChipOn]}>
            <Text style={[styles.handTxt, ballFlight === 'high' && styles.handTxtOn]}>高弹道</Text>
          </Pressable>
          <Pressable onPress={() => setBallFlight('mid')} style={[styles.handChip, ballFlight === 'mid' && styles.handChipOn]}>
            <Text style={[styles.handTxt, ballFlight === 'mid' && styles.handTxtOn]}>中弹道</Text>
          </Pressable>
          <Pressable onPress={() => setBallFlight('low')} style={[styles.handChip, ballFlight === 'low' && styles.handChipOn]}>
            <Text style={[styles.handTxt, ballFlight === 'low' && styles.handTxtOn]}>低弹道</Text>
          </Pressable>
        </View>

        <Text style={styles.fieldLabel}>球路偏差</Text>
        <View style={[styles.handRow, { flexWrap: 'wrap' }]}>
          <Pressable onPress={() => setShotShape('straight')} style={[styles.handChip, shotShape === 'straight' && styles.handChipOn]}>
            <Text style={[styles.handTxt, shotShape === 'straight' && styles.handTxtOn]}>直球</Text>
          </Pressable>
          <Pressable onPress={() => setShotShape('draw')} style={[styles.handChip, shotShape === 'draw' && styles.handChipOn]}>
            <Text style={[styles.handTxt, shotShape === 'draw' && styles.handTxtOn]}>轻抓</Text>
          </Pressable>
          <Pressable onPress={() => setShotShape('fade')} style={[styles.handChip, shotShape === 'fade' && styles.handChipOn]}>
            <Text style={[styles.handTxt, shotShape === 'fade' && styles.handTxtOn]}>轻切</Text>
          </Pressable>
          <Pressable onPress={() => setShotShape('hook')} style={[styles.handChip, shotShape === 'hook' && styles.handChipOn]}>
            <Text style={[styles.handTxt, shotShape === 'hook' && styles.handTxtOn]}>大幅左曲</Text>
          </Pressable>
          <Pressable onPress={() => setShotShape('slice')} style={[styles.handChip, shotShape === 'slice' && styles.handChipOn]}>
            <Text style={[styles.handTxt, shotShape === 'slice' && styles.handTxtOn]}>大幅右曲</Text>
          </Pressable>
        </View>

        <Text style={styles.fieldLabel}>挥杆节奏</Text>
        <View style={styles.handRow}>
          <Pressable onPress={() => setSwingTempo('slow')} style={[styles.handChip, swingTempo === 'slow' && styles.handChipOn]}>
            <Text style={[styles.handTxt, swingTempo === 'slow' && styles.handTxtOn]}>慢节奏</Text>
          </Pressable>
          <Pressable onPress={() => setSwingTempo('medium')} style={[styles.handChip, swingTempo === 'medium' && styles.handChipOn]}>
            <Text style={[styles.handTxt, swingTempo === 'medium' && styles.handTxtOn]}>中节奏</Text>
          </Pressable>
          <Pressable onPress={() => setSwingTempo('fast')} style={[styles.handChip, swingTempo === 'fast' && styles.handChipOn]}>
            <Text style={[styles.handTxt, swingTempo === 'fast' && styles.handTxtOn]}>快节奏</Text>
          </Pressable>
        </View>

        <Text style={styles.fieldLabel}>打球年限</Text>
        <TextInput value={yearsPlaying} onChangeText={setYearsPlaying} style={styles.input} placeholder="例如 5" keyboardType="number-pad" />

        <Text style={styles.fieldLabel}>单支预算（¥）</Text>
        <TextInput value={budgetPerClub} onChangeText={setBudgetPerClub} style={styles.input} placeholder="例如 50000" keyboardType="decimal-pad" />

        <Text style={styles.fieldLabel}>目前使用品牌</Text>
        <TextInput value={currentBrand} onChangeText={setCurrentBrand} style={styles.input} placeholder="例如 TaylorMade" />
      </View>

      <Pressable style={styles.saveBtn} onPress={onSaveProfile}>
        <Text style={styles.saveBtnTxt}>保存</Text>
      </Pressable>
      {saveMessage ? <Text style={styles.saveMsg}>{saveMessage}</Text> : null}

      <Text style={styles.sectionTitle}>AI顾问设置</Text>
      <View style={styles.card}>
        <Text style={styles.fieldLabel}>Anthropic API Key</Text>
        <TextInput
          value={anthropicKey}
          onChangeText={setAnthropicKey}
          style={styles.input}
          placeholder="sk-ant-..."
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
      <Pressable style={styles.saveBtn} onPress={onSaveApiKey}>
        <Text style={styles.saveBtnTxt}>保存AI设置</Text>
      </Pressable>
      {apiSaveMessage ? <Text style={styles.saveMsg}>{apiSaveMessage}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  content: { padding: 16, paddingTop: Platform.OS === 'web' ? 44 : 24, paddingBottom: 32 },
  title: { fontSize: 24, fontWeight: '700', color: TEXT_PRIMARY, marginBottom: 14 },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: TEXT_PRIMARY, marginTop: 20, marginBottom: 10 },
  card: { backgroundColor: WHITE, borderRadius: 14, borderWidth: 0.5, borderColor: BORDER, padding: 16, marginBottom: 12 },
  fieldLabel: { fontSize: 12, color: TEXT_SECONDARY, marginBottom: 6, marginTop: 6 },
  input: { borderWidth: 0.5, borderColor: BORDER, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: WHITE, fontSize: 14, color: TEXT_PRIMARY },
  handRow: { flexDirection: 'row', gap: 8, marginTop: 2, marginBottom: 8 },
  handChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 0.5, borderColor: BORDER, backgroundColor: WHITE },
  handChipOn: { borderColor: GREEN, backgroundColor: '#dcfce7' },
  handTxt: { fontSize: 13, color: TEXT_SECONDARY },
  handTxtOn: { color: GREEN, fontWeight: '700' },
  saveBtn: { marginTop: 8, backgroundColor: GREEN, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  saveBtnTxt: { color: WHITE, fontWeight: '700', fontSize: 15 },
  saveMsg: { marginTop: 10, fontSize: 12, color: GREEN, textAlign: 'center' },
});
