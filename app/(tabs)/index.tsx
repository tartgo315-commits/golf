import type { Href } from 'expo-router';
import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { ClubCategory } from '@/data/golfKnowledge';
import { useAuth } from '@/contexts/auth-context';

const GREEN = '#166534';
const GREEN_SOFT = 'rgba(22, 101, 52, 0.08)';
const BG = '#f2f4f3';
/** 四宫格统一高度，保证两行对齐 */
const GRID_CELL_MIN_H = 196;

function greetingName(email?: string) {
  if (!email) return 'Golfer';
  const local = email.split('@')[0] ?? 'Golfer';
  if (!local) return 'Golfer';
  return local.charAt(0).toUpperCase() + local.slice(1);
}

function formatHeightCm(cm?: number) {
  if (cm == null || cm <= 0) return null;
  return `${Math.round(cm)}cm`;
}

const cardShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 3,
};

function QuizCard({
  emoji,
  title,
  subtitle,
  type,
}: {
  emoji: string;
  title: string;
  subtitle: string;
  type: ClubCategory;
}) {
  return (
    <Link href={{ pathname: '/quiz/[type]', params: { type } }} asChild>
      <Pressable
        style={({ pressed }) => [styles.gridCellOuter, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={`${title} 问卷`}>
        <View style={styles.gridCellInner}>
          <Text style={styles.gridEmoji}>{emoji}</Text>
          <Text style={styles.gridTitle}>{title}</Text>
          <Text style={styles.gridSubtitle}>{subtitle}</Text>
        </View>
      </Pressable>
    </Link>
  );
}

function DualQuizCard({
  emoji,
  title,
  subtitle,
  pairs,
}: {
  emoji: string;
  title: string;
  subtitle: string;
  pairs: { label: string; type: ClubCategory }[];
}) {
  return (
    <View style={styles.gridCellOuter}>
      <View style={styles.dualTop}>
        <Text style={styles.gridEmoji}>{emoji}</Text>
        <Text style={styles.gridTitle}>{title}</Text>
        <Text style={styles.gridSubtitle}>{subtitle}</Text>
      </View>
      <View style={styles.dualBottom}>
        {pairs.map(({ label, type }) => (
          <Link key={type} href={{ pathname: '/quiz/[type]', params: { type } }} asChild>
            <Pressable
              style={({ pressed }) => [styles.dualChip, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`${label} 问卷`}>
              <Text style={styles.dualChipText}>{label}</Text>
              <Text style={styles.dualChipChevron}>›</Text>
            </Pressable>
          </Link>
        ))}
      </View>
    </View>
  );
}

function ToolCard({
  emoji,
  title,
  subtitle,
  href,
}: {
  emoji: string;
  title: string;
  subtitle: string;
  href: string;
}) {
  return (
    <Link href={href as Href} asChild>
      <Pressable
        style={({ pressed }) => [styles.toolCard, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={title}>
        <Text style={styles.toolEmoji}>{emoji}</Text>
        <View style={styles.toolTextWrap}>
          <Text style={styles.toolTitle}>{title}</Text>
          <Text style={styles.toolSubtitle}>{subtitle}</Text>
        </View>
        <Text style={styles.toolChevron}>›</Text>
      </Pressable>
    </Link>
  );
}

export default function HomeScreen() {
  const { session } = useAuth();
  const name = greetingName(session?.email);
  const heightCm = formatHeightCm(session?.profile?.heightCm);
  const heightDisplay = heightCm ?? '178cm';

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}>
      <View style={styles.headerRow}>
        <View style={styles.headerTextCol}>
          <Text style={styles.greetingSmall}>你好，{name}</Text>
          <Text style={styles.heroTitle}>配杆顾问</Text>
        </View>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarEmoji}>⛳</Text>
        </View>
      </View>

      <View style={styles.profileBar}>
        <View style={styles.profileBarLeft}>
          <Text style={styles.profileBarCaption}>我的配杆档案</Text>
          <Text style={styles.profileBarStats}>
            挥速 98mph · 差点 12 · 身高 {heightDisplay}
          </Text>
        </View>
        <Link href="/profile-setup" asChild>
          <Pressable
            style={({ pressed }) => [styles.editBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="编辑档案">
            <Text style={styles.editBtnText}>编辑</Text>
          </Pressable>
        </Link>
      </View>

      <Text style={styles.sectionLabel}>选择球杆类型开始配杆</Text>
      <View style={styles.grid}>
        <View style={styles.gridRow}>
          <QuizCard
            emoji="🏌️"
            title="一号木"
            subtitle="杆身 · 杆长 · 挥重"
            type="driver"
          />
          <QuizCard
            emoji="🔧"
            title="铁杆"
            subtitle="钢/碳杆身 · 硬度"
            type="irons"
          />
        </View>
        <View style={styles.gridRow}>
          <DualQuizCard
            emoji="🌿"
            title="球道木 / 铁木"
            subtitle="弹道 · 接口规格"
            pairs={[
              { label: '球道木', type: 'fairway' },
              { label: '铁木杆', type: 'hybrid' },
            ]}
          />
          <DualQuizCard
            emoji="🚩"
            title="挖起杆 / 推杆"
            subtitle="杆面角 · 配重"
            pairs={[
              { label: '挖起杆', type: 'wedges' },
              { label: '推杆', type: 'putter' },
            ]}
          />
        </View>
      </View>

      <Text style={styles.sectionLabel}>配杆细节工具</Text>
      <View style={styles.toolStack}>
        <ToolCard
          emoji="⚖️"
          title="挥重计算器"
          subtitle="输入杆身/杆头数据，推算目标挥重"
          href="/swing-weight"
        />
        <ToolCard
          emoji="📊"
          title="杆身对比"
          subtitle="Ventus / Kai'li / Tour AD 速查"
          href="/compare"
        />
        <ToolCard
          emoji="🤝"
          title="握把选择"
          subtitle="尺寸 · 材质 · 对挥重的影响"
          href="/grip-select"
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: BG,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 28,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerTextCol: {
    flex: 1,
    paddingRight: 12,
  },
  greetingSmall: {
    fontSize: 14,
    fontWeight: '600',
    color: GREEN,
    marginBottom: 6,
  },
  heroTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.8,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(22, 101, 52, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(22, 101, 52, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    ...cardShadow,
  },
  avatarEmoji: {
    fontSize: 26,
  },
  profileBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GREEN_SOFT,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(22, 101, 52, 0.12)',
    marginBottom: 20,
  },
  profileBarLeft: {
    flex: 1,
    paddingRight: 12,
  },
  profileBarCaption: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 6,
  },
  profileBarStats: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    lineHeight: 22,
  },
  editBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(22, 101, 52, 0.28)',
  },
  editBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: GREEN,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 12,
  },
  grid: {
    gap: 12,
    marginBottom: 24,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'stretch',
  },
  gridCellOuter: {
    flex: 1,
    flexDirection: 'column',
    minWidth: 0,
    minHeight: GRID_CELL_MIN_H,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.06)',
    ...cardShadow,
  },
  gridCellInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  gridEmoji: {
    fontSize: 32,
    marginBottom: 10,
    textAlign: 'center',
  },
  gridTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6,
    textAlign: 'center',
  },
  gridSubtitle: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 17,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  dualTop: {
    alignItems: 'center',
    marginBottom: 12,
  },
  dualBottom: {
    flex: 1,
    gap: 8,
    justifyContent: 'flex-end',
  },
  dualChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(22, 101, 52, 0.06)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(22, 101, 52, 0.12)',
  },
  dualChipText: {
    fontSize: 14,
    fontWeight: '700',
    color: GREEN,
  },
  dualChipChevron: {
    fontSize: 18,
    color: GREEN,
    fontWeight: '500',
  },
  toolStack: {
    gap: 12,
  },
  toolCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.06)',
    ...cardShadow,
  },
  toolEmoji: {
    fontSize: 24,
    marginRight: 14,
    width: 36,
    textAlign: 'center',
  },
  toolTextWrap: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  toolTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  toolSubtitle: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 19,
  },
  toolChevron: {
    fontSize: 20,
    color: '#cbd5e1',
    fontWeight: '400',
    marginLeft: 10,
    paddingLeft: 4,
  },
  pressed: {
    opacity: 0.94,
    transform: [{ scale: 0.992 }],
  },
});
