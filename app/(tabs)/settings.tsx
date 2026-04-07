import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

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
  const [dominantHand, setDominantHand] = useState<'left' | 'right'>('right');

  useFocusEffect(
    useCallback(() => {
      const p = readJson<StoredUserProfile | null>(USER_PROFILE_KEY, null);
      if (!p) return;
      setSwingSpeedMph(p.swingSpeedMph ?? '');
      setHandicap(p.handicap ?? '');
      setHeightCm(p.heightCm ?? '');
      setDominantHand(p.dominantHand ?? 'right');
    }, []),
  );

  function onSaveProfile() {
    const profile: StoredUserProfile = {
      swingSpeedMph: swingSpeedMph.trim(),
      handicap: handicap.trim(),
      heightCm: heightCm.trim(),
      dominantHand,
      updatedAt: new Date().toISOString(),
    };
    writeJson(USER_PROFILE_KEY, profile);
    Alert.alert('个人档案', '已保存');
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>个人档案</Text>

      <View style={styles.card}>
        <Text style={styles.fieldLabel}>挥速（mph）</Text>
        <TextInput value={swingSpeedMph} onChangeText={setSwingSpeedMph} style={styles.input} placeholder="例如 92" keyboardType="decimal-pad" />

        <Text style={styles.fieldLabel}>差点</Text>
        <TextInput value={handicap} onChangeText={setHandicap} style={styles.input} placeholder="例如 15" keyboardType="decimal-pad" />

        <Text style={styles.fieldLabel}>身高（cm）</Text>
        <TextInput value={heightCm} onChangeText={setHeightCm} style={styles.input} placeholder="例如 175" keyboardType="decimal-pad" />

        <Text style={styles.fieldLabel}>惯用手</Text>
        <View style={styles.handRow}>
          <Pressable onPress={() => setDominantHand('left')} style={[styles.handChip, dominantHand === 'left' && styles.handChipOn]}>
            <Text style={[styles.handTxt, dominantHand === 'left' && styles.handTxtOn]}>左手</Text>
          </Pressable>
          <Pressable onPress={() => setDominantHand('right')} style={[styles.handChip, dominantHand === 'right' && styles.handChipOn]}>
            <Text style={[styles.handTxt, dominantHand === 'right' && styles.handTxtOn]}>右手</Text>
          </Pressable>
        </View>
      </View>

      <Pressable style={styles.saveBtn} onPress={onSaveProfile}>
        <Text style={styles.saveBtnTxt}>保存</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  content: { padding: 16, paddingTop: 24, paddingBottom: 32 },
  title: { fontSize: 24, fontWeight: '700', color: TEXT_PRIMARY, marginBottom: 14 },
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
});
