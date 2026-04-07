import type { Href } from 'expo-router';
import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { ClubCategory } from '@/data/golfKnowledge';
import { useAuth } from '@/contexts/auth-context';

const GREEN = '#166534';
const GREEN_SOFT = 'rgba(22, 101, 52, 0.1)';
const BG = '#f0f2f1';

function greetingName(email?: string) {
  if (!email) return 'Golfer';
  const local = email.split('@')[0] ?? 'Golfer';
  if (!local) return 'Golfer';
  return local.charAt(0).toUpperCase() + local.slice(1);
}

function formatHeightCm(cm?: number) {
  if (cm == null || cm <= 0) return '—';
  return `${Math.round(cm)}cm`;
}

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
        style={({ pressed }) => [styles.gridCard, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={`${title} 问卷`}>
        <Text style={styles.gridEmoji}>{emoji}</Text>
        <Text style={styles.gridTitle}>{title}</Text>
        <Text style={styles.gridSubtitle}>{subtitle}</Text>
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
    <View style={styles.gridCard}>
      <Text style={styles.gridEmoji}>{emoji}</Text>
      <Text style={styles.gridTitle}>{title}</Text>
      <Text style={styles.gridSubtitle}>{subtitle}</Text>
      <View style={styles.dualLinks}>
        {pairs.map(({ label, type }) => (
          <Link key={type} href={{ pathname: '/quiz/[type]', params: { type } }} asChild>
            <Pressable
              style={({ pressed }) => [styles.dualLinkBtn, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`${label} 问卷`}>
              <Text style={styles.dualLinkText}>{label}</Text>
              <Text style={styles.dualLinkChevron}>›</Text>
            </Pressable>
          </Link>
        ))}
      </View>
    </View>
  );
}

function ToolRow({
  emoji,
  title,
  subtitle,
  href,
  last,
}: {
  emoji: string;
  title: string;
  subtitle: string;
  /** 栈路由；typed routes 需在 expo 生成后纳入 Href */
  href: string;
  last?: boolean;
}) {
  return (
    <Link href={href as Href} asChild>
      <Pressable
        style={({ pressed }) => [
          styles.toolRow,
          last && styles.toolRowNoBorder,
          pressed && styles.pressed,
        ]}
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
  const heightStr = formatHeightCm(session?.profile?.heightCm);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}>
      <View style={styles.headerRow}>
        <View style={styles.headerTextCol}>
          <Text style={styles.greetingSmall}>你好，{name} 👋</Text>
          <Text style={styles.heroTitle}>配杆顾问</Text>
        </View>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarEmoji}>⛳</Text>
        </View>
      </View>

      <View style={styles.profileBar}>
        <Text style={styles.profileBarText}>
          挥速 — · 差点 — · 身高 {heightStr}
        </Text>
        <Link href="/profile-setup" asChild>
          <Pressable
            style={({ pressed }) => [styles.editBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="编辑档案">
            <Text style={styles.editBtnText}>编辑</Text>
          </Pressable>
        </Link>
      </View>

      <Text style={styles.sectionLabel}>球杆问卷</Text>
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
      <View style={styles.toolList}>
        <ToolRow
          emoji="⚖️"
          title="挥重计算器"
          subtitle="输入杆身/杆头数据，推算目标挥重"
          href="/swing-weight"
        />
        <ToolRow
          emoji="📊"
          title="杆身对比"
          subtitle="Ventus / Kai'li / Tour AD 速查"
          href="/compare"
        />
        <ToolRow
          emoji="🤝"
          title="握把选择"
          subtitle="尺寸 · 材质 · 对挥重的影响"
          href="/grip-select"
          last
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
    padding: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerTextCol: {
    flex: 1,
    paddingRight: 12,
  },
  greetingSmall: {
    fontSize: 15,
    fontWeight: '600',
    color: GREEN,
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#14261c',
    letterSpacing: -0.5,
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: 'rgba(22, 101, 52, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  avatarEmoji: {
    fontSize: 28,
  },
  profileBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GREEN_SOFT,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(22, 101, 52, 0.18)',
    marginBottom: 22,
  },
  profileBarText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#1e3a2f',
    lineHeight: 18,
  },
  editBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(22, 101, 52, 0.35)',
  },
  editBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: GREEN,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#475569',
    marginBottom: 10,
  },
  grid: {
    gap: 12,
    marginBottom: 26,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
  },
  gridCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  gridEmoji: {
    fontSize: 26,
    marginBottom: 8,
  },
  gridTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#14261c',
    marginBottom: 4,
  },
  gridSubtitle: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 16,
  },
  dualLinks: {
    marginTop: 12,
    gap: 8,
  },
  dualLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: GREEN_SOFT,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(22, 101, 52, 0.15)',
  },
  dualLinkText: {
    fontSize: 14,
    fontWeight: '700',
    color: GREEN,
  },
  dualLinkChevron: {
    fontSize: 18,
    color: GREEN,
    fontWeight: '600',
  },
  toolList: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    overflow: 'hidden',
  },
  toolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
  },
  toolEmoji: {
    fontSize: 22,
    marginRight: 12,
  },
  toolTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  toolTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#14261c',
    marginBottom: 4,
  },
  toolSubtitle: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
  },
  toolChevron: {
    fontSize: 22,
    color: '#94a3b8',
    fontWeight: '300',
    marginLeft: 8,
  },
  toolRowNoBorder: {
    borderBottomWidth: 0,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
});
