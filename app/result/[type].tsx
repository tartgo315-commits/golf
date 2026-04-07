import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { GOLF } from '@/constants/golfTheme';
import {
  getRecommendation,
  isClubCategory,
  productsByCategory,
  type ClubCategory,
} from '@/data/golfKnowledge';
import { profileFilled, useAuth, type UserProfile } from '@/contexts/auth-context';

const QUIZ_PAYLOAD_KEY = '@gca_quiz_last_v1';
const WHITE = '#ffffff';
const BG = '#f3f4f6';
const BORDER = '#e5e7eb';
const TEXT_TITLE = '#14261c';
const TEXT_PRICE = '#2e7d32';
const TEXT_CARD_TITLE = '#1a2e22';
const TEXT_BODY = '#3d5247';
const TEXT_NOTE = '#6b7a72';
const TEXT_MUTED = '#666666';
const TEXT_ERROR = '#b00020';
const CTA_TEXT = '#ffffff';

function profileToFit(profile: UserProfile) {
  return {
    skillLevel: profile.skillLevel,
    ageGroup: profile.ageGroup,
    dominantHand: profile.dominantHand,
  };
}

type StoredQuiz = {
  category: ClubCategory;
  answers: Record<string, string>;
};

export default function ResultByTypeScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation();
  const { type: rawType } = useLocalSearchParams<{ type: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [productId, setProductId] = useState<string | null>(null);
  const [priceRange, setPriceRange] = useState('');
  const [topTags, setTopTags] = useState<string[]>([]);

  const category = rawType && isClubCategory(rawType) ? rawType : null;

  useLayoutEffect(() => {
    navigation.setOptions({ title: t('fit.screens.results') });
  }, [navigation, t, i18n.language]);

  const load = useCallback(async () => {
    if (!category) {
      setErrorKey('fit.result.invalid');
      setLoaded(true);
      return;
    }
    try {
      const raw = await AsyncStorage.getItem(QUIZ_PAYLOAD_KEY);
      if (!raw) {
        setErrorKey('fit.result.noQuiz');
        setLoaded(true);
        return;
      }
      const data = JSON.parse(raw) as StoredQuiz;
      if (data.category !== category) {
        setErrorKey('fit.result.mismatch');
        setLoaded(true);
        return;
      }
      const profile =
        session?.profile && profileFilled(session.profile)
          ? profileToFit(session.profile)
          : null;
      const rec = getRecommendation(category, data.answers, profile);
      const p = productsByCategory[category].find((x) => x.id === rec.product.id);
      setProductId(rec.product.id);
      setPriceRange(p?.priceRange ?? rec.product.priceRange);
      setTopTags(rec.topTags);
      setErrorKey(null);
    } catch {
      setErrorKey('fit.result.loadFail');
    } finally {
      setLoaded(true);
    }
  }, [category, session?.profile]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const handler = () => {
      void load();
    };
    i18n.on('languageChanged', handler);
    return () => {
      i18n.off('languageChanged', handler);
    };
  }, [i18n, load]);

  const headline = productId ? t(`fit.cat.${productId}.name`) : '';
  const blurb = productId ? t(`fit.cat.${productId}.blurb`) : '';
  const tagsJoined = useMemo(() => {
    const sep = i18n.language.startsWith('zh') ? '、' : ', ';
    return topTags
      .map((tg) => t(`fit.tags.${tg}`, { defaultValue: tg }))
      .join(sep);
  }, [topTags, t, i18n.language]);

  const rationale = useMemo(() => {
    if (!blurb) return '';
    return `${blurb} ${t('fit.result.tail', { tags: tagsJoined || t('fit.result.tagsFallback') })}`;
  }, [blurb, tagsJoined, t]);

  if (!category) {
    return (
      <View style={styles.center}>
        <Text style={styles.err}>{t('fit.result.unknownType')}</Text>
      </View>
    );
  }

  if (!loaded) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{t('fit.result.loading')}</Text>
      </View>
    );
  }

  if (errorKey) {
    return (
      <View style={styles.center}>
        <Text style={styles.err}>{t(errorKey)}</Text>
        <Pressable style={styles.btn} onPress={() => router.replace('/')}>
          <Text style={styles.btnText}>{t('fit.result.backHome')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>
      <Text style={styles.kicker}>{t('fit.result.kicker')}</Text>
      <Text style={styles.title}>{headline}</Text>
      <Text style={styles.price}>{priceRange}</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('fit.result.whyTitle')}</Text>
        <Text style={styles.body}>{rationale}</Text>
      </View>
      <Text style={styles.note}>{t('fit.result.note')}</Text>
      <Pressable style={styles.btn} onPress={() => router.replace('/')}>
        <Text style={styles.btnText}>{t('fit.result.done')}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: BG },
  scroll: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  kicker: {
    fontSize: 13,
    fontWeight: '700',
    color: GOLF.accentDark,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  title: { fontSize: 26, fontWeight: '800', color: TEXT_TITLE, marginBottom: 6 },
  price: { fontSize: 18, fontWeight: '700', color: TEXT_PRICE, marginBottom: 16 },
  card: {
    backgroundColor: WHITE,
    borderRadius: 14,
    padding: 18,
    borderWidth: 0.5,
    borderColor: BORDER,
    marginBottom: 16,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', marginBottom: 8, color: TEXT_CARD_TITLE },
  body: { fontSize: 15, lineHeight: 22, color: TEXT_BODY },
  note: { fontSize: 12, color: TEXT_NOTE, lineHeight: 18, marginBottom: 20 },
  err: { fontSize: 16, color: TEXT_ERROR, textAlign: 'center', marginBottom: 16 },
  muted: { color: TEXT_MUTED },
  btn: {
    backgroundColor: GOLF.accentDark,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  btnText: { color: CTA_TEXT, fontWeight: '700', fontSize: 16 },
});
