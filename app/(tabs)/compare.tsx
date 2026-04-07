import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const GREEN = '#166534';
const GREEN_LIGHT = '#dcfce7';
const BLUE_LIGHT = '#dbeafe';
const BLUE = '#1e40af';
const WHITE = '#ffffff';
const BG = '#f3f4f6';
const BORDER = '#e5e7eb';
const TEXT_PRIMARY = '#111827';
const TEXT_SECONDARY = '#6b7280';
const TEXT_TERTIARY = '#9ca3af';
const TEXT_DISABLED = '#d1d5db';
const DIVIDER_SOFT = '#f3f4f6';
const DIVIDER_LIGHT = '#f9fafb';

// ── 数据 ──────────────────────────────────────────────
const SHAFTS = {
  一号木: [
    {
      name: 'Ventus Blue 6S',
      brand: 'Fujikura',
      弹道: '中低',
      旋转: '低旋',
      重量: '63g',
      手感: '硬实',
      kickPoint: '高',
      recommended: true,
    },
    {
      name: "Kai'li White 60S",
      brand: 'Mitsubishi',
      弹道: '中高',
      旋转: '中旋',
      重量: '60g',
      手感: '弹柔',
      kickPoint: '低',
      recommended: false,
    },
    {
      name: 'Tour AD IZ 6S',
      brand: 'Mitsubishi',
      弹道: '低',
      旋转: '极低旋',
      重量: '65g',
      手感: '稳定',
      kickPoint: '高',
      recommended: false,
    },
  ],
  铁杆: [
    {
      name: 'DG X100',
      brand: 'True Temper',
      弹道: '低',
      旋转: '低旋',
      重量: '130g',
      手感: '极硬',
      kickPoint: '—',
      recommended: false,
    },
    {
      name: 'KBS Tour S',
      brand: 'KBS',
      弹道: '中',
      旋转: '中旋',
      重量: '120g',
      手感: '稳定',
      kickPoint: '—',
      recommended: true,
    },
    {
      name: 'NS Pro 950',
      brand: 'Nippon',
      弹道: '中高',
      旋转: '中旋',
      重量: '95g',
      手感: '轻弹',
      kickPoint: '—',
      recommended: false,
    },
  ],
  球道木: [
    {
      name: 'Ventus Blue 7S',
      brand: 'Fujikura',
      弹道: '中低',
      旋转: '低旋',
      重量: '72g',
      手感: '硬实',
      kickPoint: '高',
      recommended: true,
    },
    {
      name: 'Tour AD DI 7S',
      brand: 'Mitsubishi',
      弹道: '中',
      旋转: '中旋',
      重量: '70g',
      手感: '全能',
      kickPoint: '中',
      recommended: false,
    },
    {
      name: 'Tensei AV 75S',
      brand: 'Mitsubishi',
      弹道: '中',
      旋转: '中旋',
      重量: '75g',
      手感: '稳定',
      kickPoint: '中',
      recommended: false,
    },
  ],
};

const HEADS = {
  一号木: [
    {
      name: 'Ping G430 Max',
      type: '宽容型',
      杆面角: '10.5°',
      体积: '460cc',
      重心: '深',
      宽容度: 5,
      操控性: 3,
      差点: '12+',
      recommended: true,
    },
    {
      name: 'TaylorMade Qi10',
      type: '距离型',
      杆面角: '9°',
      体积: '460cc',
      重心: '中',
      宽容度: 4,
      操控性: 4,
      差点: '6–15',
      recommended: false,
    },
    {
      name: 'Titleist TSR3',
      type: '操控型',
      杆面角: '10°',
      体积: '450cc',
      重心: '浅',
      宽容度: 3,
      操控性: 5,
      差点: '0–8',
      recommended: false,
    },
  ],
  铁杆: [
    {
      name: 'Ping i230',
      type: '精准型',
      杆面角: '—',
      体积: '—',
      重心: '低',
      宽容度: 3,
      操控性: 5,
      差点: '0–10',
      recommended: false,
    },
    {
      name: 'Callaway Apex',
      type: '宽容型',
      杆面角: '—',
      体积: '—',
      重心: '低深',
      宽容度: 4,
      操控性: 4,
      差点: '5–15',
      recommended: true,
    },
    {
      name: 'TaylorMade P790',
      type: '中空锻造',
      杆面角: '—',
      体积: '—',
      重心: '中',
      宽容度: 4,
      操控性: 4,
      差点: '5–15',
      recommended: false,
    },
  ],
};

const PROFILE = {
  swingSpeedMph: 92,
  handicap: 12,
  heightCm: 175,
};

const RECOMMENDED_SETS = [
  {
    key: 'control',
    label: '操控型套杆',
    range: '差点 0–8',
    head: 'TSR3',
    shaft: 'Tour AD IZ + DG X100',
    length: '45.0"（Driver）/ 标准铁杆长',
    swingWeight: 'D3',
    grip: '标准 +1 层胶带',
  },
  {
    key: 'forgiving',
    label: '宽容型套杆',
    range: '差点 9–18',
    head: 'G430 Max',
    shaft: 'Ventus Blue + KBS Tour',
    length: '45.25"（Driver）/ 标准铁杆长',
    swingWeight: 'D2',
    grip: '标准口径',
  },
  {
    key: 'super-forgiving',
    label: '超宽容套杆',
    range: '差点 18+',
    head: 'Stealth',
    shaft: "Kai'li + NS Pro 950",
    length: '45.5"（Driver）/ +0.25" 铁杆长',
    swingWeight: 'D1',
    grip: 'Midsize 轻量款',
  },
];

type ShaftRow = (typeof SHAFTS)['一号木'][number];
const SHAFT_FIELDS: (keyof ShaftRow)[] = ['弹道', '旋转', '重量', '手感', 'kickPoint'];

// ── 组件 ──────────────────────────────────────────────
function Stars({ count, max = 5 }: { count: number; max?: number }) {
  return (
    <Text style={{ fontSize: 11 }}>
      {Array.from({ length: max }, (_, i) => (
        <Text key={i} style={{ color: i < count ? GREEN : TEXT_DISABLED }}>
          ★
        </Text>
      ))}
    </Text>
  );
}

function ShaftTab() {
  const [clubType, setClubType] = useState<keyof typeof SHAFTS>('一号木');
  const shafts = SHAFTS[clubType];

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipRow}>
        {(Object.keys(SHAFTS) as (keyof typeof SHAFTS)[]).map((k) => (
          <TouchableOpacity
            key={k}
            onPress={() => setClubType(k)}
            style={[s.chip, clubType === k && s.chipActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: clubType === k }}>
            <Text style={[s.chipText, clubType === k && s.chipTextActive]}>{k}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView horizontal={true} showsHorizontalScrollIndicator={false}>
        <View style={s.cardRow}>
          {shafts.map((sh) => (
            <View key={sh.name} style={[s.shaftCard, sh.recommended && s.cardHighlight]}>
              {sh.recommended && (
                <View style={s.badge}>
                  <Text style={s.badgeText}>推荐</Text>
                </View>
              )}
              <Text style={s.cardTitle} numberOfLines={2}>
                {sh.name}
              </Text>
              <Text style={s.cardBrand}>{sh.brand}</Text>
              {SHAFT_FIELDS.map((f) => (
                <View key={String(f)} style={s.cardRow2}>
                  <Text style={s.fieldLabel}>{f === 'kickPoint' ? '拐点' : String(f)}</Text>
                  <Text style={s.fieldValue}>{String(sh[f])}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={s.infoBox}>
        <Text style={s.infoText}>弹道偏高 → 选 Kai&apos;li 系列　弹道偏低 → 选 IZ / Ventus Blue</Text>
      </View>
    </View>
  );
}

/** 杆头对比：一号木三款（与需求一致），纵向卡片避免 48% 栅格出现 2+1 */
function HeadTab() {
  const heads = HEADS['一号木'];

  return (
    <View>
      <Text style={s.headIntro}>一号木杆头</Text>
      <View style={s.headColumn}>
        {heads.map((h) => (
          <View key={h.name} style={[s.headCardFull, h.recommended && s.cardHighlight]}>
            {h.recommended && (
              <View style={s.badgeFit}>
                <Text style={s.badgeFitText}>适合你</Text>
              </View>
            )}
            <Text style={s.cardTitle}>{h.name}</Text>
            <Text style={s.cardBrand}>{h.type}</Text>
            {[
              ['杆面角', h.杆面角],
              ['体积', h.体积],
              ['重心', h.重心],
              ['适合差点', h.差点],
            ].map(([k, v]) => (
              <View key={k} style={s.cardRow2}>
                <Text style={s.fieldLabel}>{k}</Text>
                <Text style={s.fieldValue}>{v}</Text>
              </View>
            ))}
            <View style={s.cardRow2}>
              <Text style={s.fieldLabel}>宽容度</Text>
              <Stars count={h.宽容度} />
            </View>
            <View style={s.cardRow2}>
              <Text style={s.fieldLabel}>操控性</Text>
              <Stars count={h.操控性} />
            </View>
          </View>
        ))}
      </View>

      <View style={s.infoBox}>
        <Text style={s.infoText}>差点 12+ 优先宽容度　差点 8 以下可选操控型</Text>
      </View>
    </View>
  );
}

function RecommendTab() {
  const recommendedSet =
    PROFILE.handicap <= 8
      ? RECOMMENDED_SETS[0]
      : PROFILE.handicap <= 18
        ? RECOMMENDED_SETS[1]
        : RECOMMENDED_SETS[2];

  return (
    <View>
      <View style={s.profileCard}>
        <Text style={s.cardTitle}>用户档案（示例）</Text>
        <View style={s.cardRow2}>
          <Text style={s.fieldLabel}>挥速</Text>
          <Text style={s.fieldValue}>{PROFILE.swingSpeedMph} mph</Text>
        </View>
        <View style={s.cardRow2}>
          <Text style={s.fieldLabel}>差点</Text>
          <Text style={s.fieldValue}>{PROFILE.handicap}</Text>
        </View>
        <View style={s.cardRow2}>
          <Text style={s.fieldLabel}>身高</Text>
          <Text style={s.fieldValue}>{PROFILE.heightCm} cm</Text>
        </View>
      </View>

      <View style={s.setCard}>
        <Text style={s.cardTitle}>推荐结果：{recommendedSet.label}</Text>
        <Text style={s.cardBrand}>{recommendedSet.range}</Text>

        <View style={s.cardRow2}>
          <Text style={s.fieldLabel}>杆头</Text>
          <Text style={s.fieldValue}>{recommendedSet.head}</Text>
        </View>
        <View style={s.cardRow2}>
          <Text style={s.fieldLabel}>杆身</Text>
          <Text style={s.fieldValue}>{recommendedSet.shaft}</Text>
        </View>
        <View style={s.cardRow2}>
          <Text style={s.fieldLabel}>杆长</Text>
          <Text style={s.fieldValue}>{recommendedSet.length}</Text>
        </View>
        <View style={s.cardRow2}>
          <Text style={s.fieldLabel}>挥重</Text>
          <Text style={s.fieldValue}>{recommendedSet.swingWeight}</Text>
        </View>
        <View style={s.cardRow2}>
          <Text style={s.fieldLabel}>握把</Text>
          <Text style={s.fieldValue}>{recommendedSet.grip}</Text>
        </View>
      </View>

      <View style={[s.infoBox, s.reportBtn]}>
        <Text style={s.reportBtnText}>生成配杆报告</Text>
      </View>
    </View>
  );
}

// ── 主页面 ───────────────────────────────────────────
const TABS = ['杆身对比', '杆头对比', '套杆推荐'];

export default function CompareScreen() {
  const [tab, setTab] = useState(0);

  return (
    <View style={s.container}>
      <View style={s.tabBar}>
        {TABS.map((t, i) => (
          <Pressable
            key={t}
            onPress={() => setTab(i)}
            style={({ pressed }) => [s.tabBtn, tab === i && s.tabActive, pressed && s.tabPressed]}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === i }}>
            <Text style={[s.tabText, tab === i && s.tabTextActive]}>{t}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled">
        {tab === 0 ? <ShaftTab /> : null}
        {tab === 1 ? <HeadTab /> : null}
        {tab === 2 ? <RecommendTab /> : null}
      </ScrollView>
    </View>
  );
}

// ── 样式 ─────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: WHITE,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
    zIndex: 2,
    elevation: 4,
  },
  tabBtn: {
    flex: 1,
    minHeight: 48,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: GREEN, backgroundColor: GREEN_LIGHT },
  tabText: { fontSize: 13, color: TEXT_SECONDARY },
  tabTextActive: { fontSize: 13, color: GREEN, fontWeight: '600' },
  tabPressed: { opacity: 0.88 },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32, flexGrow: 1 },

  chipRow: { marginBottom: 12 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: WHITE,
    borderWidth: 0.5,
    borderColor: BORDER,
    marginRight: 8,
  },
  chipActive: { backgroundColor: GREEN_LIGHT, borderColor: GREEN },
  chipText: { fontSize: 12, color: TEXT_SECONDARY },
  chipTextActive: { color: GREEN, fontWeight: '500' },

  cardRow: { flexDirection: 'row', paddingBottom: 4, paddingRight: 10 },

  shaftCard: {
    width: 150,
    marginRight: 10,
    backgroundColor: WHITE,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: BORDER,
    padding: 12,
  },
  headIntro: { fontSize: 13, fontWeight: '600', color: GREEN, marginBottom: 10 },
  headColumn: { gap: 8, marginBottom: 8 },
  headCardFull: {
    width: '100%',
    backgroundColor: WHITE,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: BORDER,
    padding: 14,
  },
  badgeFit: {
    alignSelf: 'flex-start',
    backgroundColor: GREEN,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 8,
  },
  badgeFitText: { fontSize: 10, color: WHITE, fontWeight: '700' },

  cardHighlight: { borderWidth: 2, borderColor: GREEN },
  badge: {
    backgroundColor: GREEN_LIGHT,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  badgeText: { fontSize: 10, color: GREEN, fontWeight: '500' },

  cardTitle: { fontSize: 13, fontWeight: '600', color: TEXT_PRIMARY, marginBottom: 2 },
  cardBrand: { fontSize: 11, color: TEXT_TERTIARY, marginBottom: 10 },
  cardRow2: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  fieldLabel: { fontSize: 11, color: TEXT_TERTIARY },
  fieldValue: { fontSize: 11, color: TEXT_PRIMARY, fontWeight: '500', flexShrink: 1, textAlign: 'right' },

  infoBox: { backgroundColor: GREEN_LIGHT, borderRadius: 10, padding: 10 },
  infoText: { fontSize: 12, color: GREEN },

  setCard: {
    backgroundColor: WHITE,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: BORDER,
    padding: 14,
    marginBottom: 8,
  },
  profileCard: {
    backgroundColor: WHITE,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: BORDER,
    padding: 14,
    marginBottom: 8,
  },
  reportBtn: { marginTop: 8, alignItems: 'center' },
  reportBtnText: { fontSize: 14, fontWeight: '700', color: GREEN },
  arrow: { fontSize: 12, color: TEXT_TERTIARY },
  setDetail: { marginTop: 12, borderTopWidth: 0.5, borderTopColor: DIVIDER_SOFT, paddingTop: 10 },
  setTableHeader: { flexDirection: 'row', marginBottom: 6 },
  setTableRow: { flexDirection: 'row', paddingVertical: 6, borderTopWidth: 0.5, borderTopColor: DIVIDER_LIGHT },
  tableHead: { fontSize: 11, fontWeight: '600', color: TEXT_SECONDARY },
  setCol0: { width: 52, fontSize: 11 },
  setCol1: { flex: 1, fontSize: 11, paddingRight: 6 },
  setCol2: { flex: 1, fontSize: 11 },
});
