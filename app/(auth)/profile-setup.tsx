import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { GOLF } from '@/constants/golfTheme';
import { useAuth, type UserProfile } from '@/contexts/auth-context';

/** Demo default so users can reach the app home without filling every field. */
const DEFAULT_PROFILE: UserProfile = {
  heightCm: 175,
  weightKg: 72,
  dominantHand: 'right',
  skillLevel: 'intermediate',
  ageGroup: 'adult',
};

type ChipOpt<T extends string> = { value: T; label: string };

function ChipRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: ChipOpt<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={chipStyles.block}>
      <Text style={chipStyles.label}>{label}</Text>
      <View style={chipStyles.row}>
        {options.map((o) => {
          const active = o.value === value;
          return (
            <Pressable
              key={o.value}
              onPress={() => onChange(o.value)}
              style={[chipStyles.chip, active && chipStyles.chipOn]}>
              <Text style={[chipStyles.chipText, active && chipStyles.chipTextOn]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const chipStyles = StyleSheet.create({
  block: { marginBottom: 18 },
  label: { color: GOLF.muted, fontSize: 13, fontWeight: '600', marginBottom: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: GOLF.border,
    backgroundColor: GOLF.inputBg,
  },
  chipOn: {
    borderColor: GOLF.accent,
    backgroundColor: 'rgba(94, 207, 154, 0.18)',
  },
  chipText: { color: GOLF.muted, fontSize: 14, fontWeight: '600' },
  chipTextOn: { color: GOLF.text },
});

export default function ProfileSetupScreen() {
  const router = useRouter();
  const { hydrated, session, saveProfile, signOut } = useAuth();
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [dominantHand, setDominantHand] = useState<UserProfile['dominantHand']>('right');
  const [skillLevel, setSkillLevel] = useState<UserProfile['skillLevel']>('intermediate');
  const [ageGroup, setAgeGroup] = useState<UserProfile['ageGroup']>('adult');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (hydrated && !session) {
      router.replace('/login');
    }
  }, [hydrated, session, router]);

  async function onSkipDefaults() {
    try {
      setBusy(true);
      await saveProfile(DEFAULT_PROFILE);
      router.replace('/(tabs)');
    } catch (e) {
      Alert.alert('Profile', e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  async function onBackToSignIn() {
    await signOut();
    router.replace('/login');
  }

  async function onContinue() {
    const h = Number(heightCm);
    const w = Number(weightKg);
    if (!Number.isFinite(h) || h < 100 || h > 230) {
      Alert.alert('Profile', 'Enter a realistic height in cm (100–230).');
      return;
    }
    if (!Number.isFinite(w) || w < 30 || w > 200) {
      Alert.alert('Profile', 'Enter a realistic weight in kg (30–200).');
      return;
    }
    try {
      setBusy(true);
      const profile: UserProfile = {
        heightCm: Math.round(h),
        weightKg: Math.round(w),
        dominantHand,
        skillLevel,
        ageGroup,
      };
      await saveProfile(profile);
      router.replace('/(tabs)');
    } catch (e) {
      Alert.alert('Profile', e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  if (!hydrated || !session) {
    return <View style={styles.boot} />;
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bounces={false}>
        <Pressable onPress={onBackToSignIn} style={styles.backRow} hitSlop={8}>
          <Text style={styles.backText}>← Back to sign in</Text>
        </Pressable>

        <Text style={styles.title}>Your profile</Text>
        <Text style={styles.subtitle}>
          Fill this out so recommendations match you better. It’s saved on this device for the demo.
          After you tap Save & continue, you’ll land on the app home.
        </Text>

        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Height (cm)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 178"
            placeholderTextColor={GOLF.muted}
            keyboardType="number-pad"
            value={heightCm}
            onChangeText={setHeightCm}
          />
          <Text style={styles.fieldLabel}>Weight (kg)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 75"
            placeholderTextColor={GOLF.muted}
            keyboardType="decimal-pad"
            value={weightKg}
            onChangeText={setWeightKg}
          />

          <ChipRow<UserProfile['dominantHand']>
            label="Dominant hand"
            value={dominantHand}
            onChange={setDominantHand}
            options={[
              { value: 'left', label: 'Left' },
              { value: 'right', label: 'Right' },
            ]}
          />

          <ChipRow<UserProfile['skillLevel']>
            label="Skill level"
            value={skillLevel}
            onChange={setSkillLevel}
            options={[
              { value: 'beginner', label: 'Beginner' },
              { value: 'intermediate', label: 'Intermediate' },
              { value: 'advanced', label: 'Advanced' },
            ]}
          />

          <ChipRow<UserProfile['ageGroup']>
            label="Age group"
            value={ageGroup}
            onChange={setAgeGroup}
            options={[
              { value: 'junior', label: 'Junior' },
              { value: 'adult', label: 'Adult' },
              { value: 'senior', label: 'Senior' },
            ]}
          />

          <Pressable
            style={[styles.primary, busy && styles.disabled]}
            onPress={onContinue}
            disabled={busy}>
            <Text style={styles.primaryText}>Save & continue</Text>
          </Pressable>

          <Pressable
            style={[styles.secondary, busy && styles.disabled]}
            onPress={onSkipDefaults}
            disabled={busy}>
            <Text style={styles.secondaryText}>Skip for now — use default profile</Text>
          </Pressable>

          <Pressable onPress={onBackToSignIn} style={styles.textLinkWrap} disabled={busy}>
            <Text style={styles.textLink}>Sign out and use another account</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  boot: { flex: 1, backgroundColor: GOLF.bg },
  flex: { flex: 1, backgroundColor: GOLF.bg },
  scroll: { padding: 24, paddingTop: Platform.OS === 'web' ? 44 : 24, paddingBottom: 40 },
  backRow: { alignSelf: 'flex-start', marginBottom: 16 },
  backText: { color: GOLF.accent, fontSize: 16, fontWeight: '600' },
  title: { fontSize: 28, fontWeight: '800', color: GOLF.text },
  subtitle: { marginTop: 8, marginBottom: 20, fontSize: 15, color: GOLF.muted, lineHeight: 22 },
  card: {
    backgroundColor: GOLF.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GOLF.border,
    padding: 20,
  },
  fieldLabel: { color: GOLF.muted, fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: {
    backgroundColor: GOLF.inputBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: GOLF.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: GOLF.text,
    fontSize: 16,
    marginBottom: 14,
  },
  primary: {
    backgroundColor: GOLF.gold,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  primaryText: { color: '#1a2e22', fontSize: 17, fontWeight: '700' },
  secondary: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: GOLF.border,
    backgroundColor: 'transparent',
  },
  secondaryText: { color: GOLF.accent, fontSize: 16, fontWeight: '700' },
  textLinkWrap: { marginTop: 18, alignItems: 'center', paddingVertical: 8 },
  textLink: { color: GOLF.muted, fontSize: 14, textDecorationLine: 'underline' },
  disabled: { opacity: 0.6 },
});
