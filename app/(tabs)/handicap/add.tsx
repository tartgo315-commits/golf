import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { ScorecardEntry } from '@/components/ScorecardEntry';
import { DARK_PAGE } from '@/constants/theme';
import {
  handicapIndexHref,
  pickFromParam,
  returnHrefForFrom,
  TABS_ROOT_HREF,
} from '@/utils/tabReturnFrom';

const BG = DARK_PAGE.bg;

export default function HandicapAddScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    from?: string | string[];
    outer?: string | string[];
    courseName?: string | string[];
    holes?: string | string[];
    partners?: string | string[];
  }>();
  const fromKey = pickFromParam(params.from);
  const outerKey = pickFromParam(params.outer);
  const presetCourseName = pickFromParam(params.courseName);
  const presetHolesRaw = pickFromParam(params.holes);
  const presetPartners = pickFromParam(params.partners);
  const presetRoundHoles =
    presetHolesRaw === '9' ? 9 : presetHolesRaw === '18' ? 18 : undefined;

  const returnHref = useMemo(() => returnHrefForFrom(fromKey), [fromKey]);

  const onBack = useCallback(() => {
    if (fromKey === 'hcp') {
      router.replace(handicapIndexHref(outerKey ?? 'index'));
      return;
    }
    if (returnHref) {
      router.replace(returnHref);
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(TABS_ROOT_HREF);
  }, [router, fromKey, outerKey, returnHref]);

  const afterSaveHandicapHref = useMemo((): Href => {
    if (fromKey === 'hcp') return handicapIndexHref(outerKey ?? 'index');
    if (fromKey === 'bet') return '/bet' as Href;
    if (fromKey && fromKey !== 'hcp') return handicapIndexHref(fromKey);
    return '/handicap?from=score' as Href;
  }, [fromKey, outerKey]);

  return (
    <View style={styles.container}>
      <ScorecardEntry
        onBack={onBack}
        handicapAfterSaveHref={afterSaveHandicapHref}
        initialCourseName={presetCourseName ?? undefined}
        initialRoundHoles={presetRoundHoles}
        initialPartnersLine={presetPartners ?? undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
});
