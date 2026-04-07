import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

/** 主色：与首页绿色系一致；推荐描边用任务指定 #166534 */
const GREEN = '#1b5e20';
const GREEN_REC = '#166534';
const BG = '#f0f2f1';

type ClubFilter = 'driver' | 'irons' | 'fairway';
type MainTab = 'shaft' | 'head' | 'plan';

type ShaftRow = {
  name: string;
  brand: string;
  trajectory: string;
  spin: string;
  weight: string;
  feel: string;
  recommended: boolean;
};

const SHAFT_DATA: Record<ClubFilter, ShaftRow[]> = {
  driver: [
    {
      name: 'HZRDUS Smoke RDX',
      brand: 'Project X',
      trajectory: '中低',
      spin: '偏低',
      weight: '60g',
      feel: '扎实',
      recommended: false,
    },
    {
      name: 'TENSEI AV RAW',
      brand: 'Mitsubishi',
      trajectory: '中',
      spin: '中',
      weight: '55g',
      feel: '顺滑',
      recommended: true,
    },
    {
      name: 'EvenFlow Riptide',
      brand: 'Project X',
      trajectory: '中高',
      spin: '偏高',
      weight: '50g',
      feel: '弹性',
      recommended: false,
    },
  ],
  irons: [
    {
      name: 'Dynamic Gold 120',
      brand: 'True Temper',
      trajectory: '低',
      spin: '低',
      weight: '120g',
      feel: '极稳',
      recommended: true,
    },
    {
      name: 'KBS $-Taper Lite',
      brand: 'KBS',
      trajectory: '中',
      spin: '中',
      weight: '110g',
      feel: '清脆',
      recommended: false,
    },
    {
      name: 'Nippon Modus 105',
      brand: 'Nippon',
      trajectory: '中高',
      spin: '中高',
      weight: '105g',
      feel: '柔和',
      recommended: false,
    },
  ],
  fairway: [
    {
      name: 'Diamana ZF',
      brand: 'Mitsubishi',
      trajectory: '中',
      spin: '中',
      weight: '65g',
      feel: '平衡',
      recommended: false,
    },
    {
      name: 'Ventus TR Red',
      brand: 'Fujikura',
      trajectory: '中低',
      spin: '偏低',
      weight: '70g',
      feel: '稳定',
      recommended: true,
    },
    {
      name: 'Speeder NX',
      brand: 'Fujikura',
      trajectory: '中高',
      spin: '偏高',
      weight: '60g',
      feel: '轻快',
      recommended: false,
    },
  ],
};

type HeadRow = {
  model: string;
  loft: string;
  volume: string;
  cogDepth: string;
  forgiveness: number;
  workability: number;
  recommended: boolean;
};

const HEAD_DATA: HeadRow[] = [
  {
    model: 'Stealth 2 Plus',
    loft: '9° 可调',
    volume: '460cc',
    cogDepth: '偏前',
    forgiveness: 3,
    workability: 5,
    recommended: false,
  },
  {
    model: 'Qi10 Max',
    loft: '10.5° 固定',
    volume: '460cc',
    cogDepth: '深低',
    forgiveness: 5,
    workability: 3,
    recommended: true,
  },
];

const PLAN_SUMMARY = {
  head: 'TaylorMade Qi10 Max 10.5°',
  shaft: 'Fujikura Ventus TR Red 5S',
  length: '45.25"',
  swingWeight: 'D2',
  grip: 'Golf Pride MCC Plus4 中号',
};

const PLAN_NOTES: { kind: 'flex' | 'adapter' | 'sw'; label: string; text: string }[] = [
  { kind: 'flex', label: '硬度', text: '当前推荐 S，若杆头速度偏慢可试 R。' },
  { kind: 'adapter', label: '接口', text: '确认套管与杆头品牌匹配，避免拧不紧。' },
  { kind: 'sw', label: '挥重', text: '加长 0.25" 时建议配合配重微调挥重。' },
];

const NOTE_PALETTE = {
  flex: {
    bg: 'rgba(22, 101, 52, 0.12)',
    border: 'rgba(22, 101, 52, 0.35)',
    text: GREEN_REC,
  },
  adapter: {
    bg: 'rgba(37, 99, 235, 0.1)',
    border: 'rgba(37, 99, 235, 0.35)',
    text: '#1d4ed8',
  },
  sw: {
    bg: 'rgba(180, 83, 9, 0.12)',
    border: 'rgba(180, 83, 9, 0.4)',
    text: '#b45309',
  },
} as const;

function Stars({ value, max = 5 }: { value: number; max?: number }) {
  const filled = Math.max(0, Math.min(max, Math.round(value)));
  return (
    <Text style={styles.stars} accessibilityLabel={`${filled} out of ${max}`}>
      {'★'.repeat(filled)}
      <Text style={styles.starsEmpty}>{'☆'.repeat(max - filled)}</Text>
    </Text>
  );
}

export default function CompareScreen() {
  const [mainTab, setMainTab] = useState<MainTab>('shaft');
  const [clubFilter, setClubFilter] = useState<ClubFilter>('driver');

  const shafts = SHAFT_DATA[clubFilter];

  return (
    <View style={styles.screen}>
      <Text style={styles.pageTitle}>对比</Text>

      <View style={styles.topTabs}>
        {(
          [
            { key: 'shaft' as const, label: '杆身对比' },
            { key: 'head' as const, label: '杆头对比' },
            { key: 'plan' as const, label: '推荐方案' },
          ] as const
        ).map(({ key, label }) => (
          <Pressable
            key={key}
            onPress={() => setMainTab(key)}
            style={({ pressed }) => [
              styles.topTabBtn,
              mainTab === key && styles.topTabBtnActive,
              pressed && styles.pressed,
            ]}
            accessibilityRole="tab"
            accessibilityState={{ selected: mainTab === key }}>
            <Text style={[styles.topTabText, mainTab === key && styles.topTabTextActive]}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {mainTab === 'shaft' && (
          <>
            <Text style={styles.sectionHint}>按球杆类型筛选示例杆身（假数据）</Text>
            <View style={styles.pillRow}>
              {(
                [
                  { key: 'driver' as const, label: '一号木' },
                  { key: 'irons' as const, label: '铁杆' },
                  { key: 'fairway' as const, label: '球道木' },
                ] as const
              ).map(({ key, label }) => (
                <Pressable
                  key={key}
                  onPress={() => setClubFilter(key)}
                  style={({ pressed }) => [
                    styles.pill,
                    clubFilter === key && styles.pillActive,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: clubFilter === key }}>
                  <Text style={[styles.pillText, clubFilter === key && styles.pillTextActive]}>
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.shaftCardsRow}>
              {shafts.map((s) => (
                <View
                  key={s.name}
                  style={[
                    styles.shaftCard,
                    s.recommended && styles.shaftCardRecommended,
                  ]}>
                  {s.recommended && (
                    <View style={styles.cornerBadge}>
                      <Text style={styles.cornerBadgeText}>推荐</Text>
                    </View>
                  )}
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {s.name}
                  </Text>
                  <Text style={styles.cardBrand}>{s.brand}</Text>
                  <ShaftLine k="弹道" v={s.trajectory} />
                  <ShaftLine k="旋转" v={s.spin} />
                  <ShaftLine k="重量" v={s.weight} />
                  <ShaftLine k="手感" v={s.feel} />
                </View>
              ))}
            </ScrollView>
          </>
        )}

        {mainTab === 'head' && (
          <>
            <Text style={styles.sectionHint}>杆头参数对比（假数据）</Text>
            <View style={styles.headRow}>
              {HEAD_DATA.map((h) => (
                <View
                  key={h.model}
                  style={[styles.headCard, h.recommended && styles.headCardRecommended]}>
                  {h.recommended && (
                    <View style={styles.cornerBadgeFit}>
                      <Text style={styles.cornerBadgeText}>适合你</Text>
                    </View>
                  )}
                  <Text style={[styles.cardTitle, styles.headModelTitle]}>{h.model}</Text>
                  <HeadLine k="杆面角" v={h.loft} />
                  <HeadLine k="杆头体积" v={h.volume} />
                  <HeadLine k="重心深度" v={h.cogDepth} />
                  <View style={styles.starRow}>
                    <Text style={styles.starLabel}>宽容度</Text>
                    <Stars value={h.forgiveness} />
                  </View>
                  <View style={styles.starRow}>
                    <Text style={styles.starLabel}>操控性</Text>
                    <Stars value={h.workability} />
                  </View>
                </View>
              ))}
            </View>
            <Text style={styles.headSummary}>
              总结：若追求易打与容错，偏向重心更深、宽容度更高的杆头；若追求弹道塑造，可适当牺牲部分容错选择更靠前的重心设计。
            </Text>
          </>
        )}

        {mainTab === 'plan' && (
          <>
            <Text style={styles.sectionHint}>配杆汇总（假数据，后续接真实推荐）</Text>
            <View style={styles.planCard}>
              <PlanLine k="杆头" v={PLAN_SUMMARY.head} />
              <PlanLine k="杆身" v={PLAN_SUMMARY.shaft} />
              <PlanLine k="杆长" v={PLAN_SUMMARY.length} />
              <PlanLine k="目标挥重" v={PLAN_SUMMARY.swingWeight} />
              <PlanLine k="握把" v={PLAN_SUMMARY.grip} />
            </View>
            <Text style={styles.notesTitle}>注意事项</Text>
            {PLAN_NOTES.map((n) => {
              const c = NOTE_PALETTE[n.kind];
              return (
                <View
                  key={n.label}
                  style={[styles.noteRow, { backgroundColor: c.bg, borderColor: c.border }]}>
                  <View style={[styles.noteLabel, { borderColor: c.border }]}>
                    <Text style={[styles.noteLabelText, { color: c.text }]}>{n.label}</Text>
                  </View>
                  <Text style={styles.noteBody}>{n.text}</Text>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function ShaftLine({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.kvRow}>
      <Text style={styles.k}>{k}</Text>
      <Text style={styles.v}>{v}</Text>
    </View>
  );
}

function HeadLine({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.kvRow}>
      <Text style={styles.k}>{k}</Text>
      <Text style={styles.v}>{v}</Text>
    </View>
  );
}

function PlanLine({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.planLine}>
      <Text style={styles.planK}>{k}</Text>
      <Text style={styles.planV}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#14261c',
    marginBottom: 14,
  },
  topTabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(27, 94, 32, 0.08)',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  topTabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  topTabBtnActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 2,
  },
  topTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3d5247',
  },
  topTabTextActive: {
    color: GREEN,
  },
  pressed: {
    opacity: 0.88,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 28,
  },
  sectionHint: {
    fontSize: 13,
    color: '#3d5247',
    marginBottom: 10,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: GREEN,
    backgroundColor: 'rgba(27, 94, 32, 0.06)',
  },
  pillActive: {
    backgroundColor: GREEN,
    borderColor: GREEN,
  },
  pillText: {
    fontSize: 14,
    fontWeight: '700',
    color: GREEN,
  },
  pillTextActive: {
    color: '#fff',
  },
  shaftCardsRow: {
    gap: 10,
    paddingRight: 4,
  },
  shaftCard: {
    width: 118,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  shaftCardRecommended: {
    borderColor: GREEN_REC,
    backgroundColor: 'rgba(22, 101, 52, 0.04)',
  },
  cornerBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: GREEN_REC,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderBottomLeftRadius: 8,
    zIndex: 1,
  },
  cornerBadgeFit: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: GREEN_REC,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderBottomLeftRadius: 8,
    zIndex: 1,
  },
  cornerBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#14261c',
    marginBottom: 4,
    paddingRight: 44,
    minHeight: 36,
  },
  headModelTitle: {
    fontSize: 15,
    minHeight: 0,
  },
  cardBrand: {
    fontSize: 12,
    color: GREEN,
    fontWeight: '700',
    marginBottom: 10,
  },
  kvRow: {
    marginBottom: 6,
  },
  k: {
    fontSize: 10,
    color: '#64748b',
    marginBottom: 2,
  },
  v: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e293b',
  },
  headRow: {
    flexDirection: 'row',
    gap: 12,
  },
  headCard: {
    flex: 1,
    minWidth: 0,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  headCardRecommended: {
    borderColor: GREEN_REC,
    backgroundColor: 'rgba(22, 101, 52, 0.04)',
  },
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  starLabel: {
    fontSize: 12,
    color: '#3d5247',
    fontWeight: '600',
  },
  stars: {
    fontSize: 14,
    color: '#ca8a04',
    letterSpacing: 1,
  },
  starsEmpty: {
    color: 'rgba(202, 138, 4, 0.35)',
  },
  headSummary: {
    marginTop: 18,
    fontSize: 14,
    lineHeight: 22,
    color: '#334155',
    backgroundColor: 'rgba(27, 94, 32, 0.06)',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(27, 94, 32, 0.15)',
  },
  planCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(27, 94, 32, 0.2)',
  },
  planLine: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  planK: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
    fontWeight: '600',
  },
  planV: {
    fontSize: 15,
    fontWeight: '700',
    color: '#14261c',
  },
  notesTitle: {
    marginTop: 20,
    marginBottom: 10,
    fontSize: 16,
    fontWeight: '800',
    color: GREEN,
  },
  noteRow: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  noteLabel: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  noteLabelText: {
    fontSize: 12,
    fontWeight: '800',
  },
  noteBody: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    color: '#334155',
  },
});
