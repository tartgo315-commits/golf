import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';

export type TrendDatum = { date: string; value: number | null };

export type MiniTrendChartProps = {
  data: TrendDatum[];
  height?: number;
  color?: string;
  /** 预留：数值后缀（如 %），当前不在图上展示 */
  suffix?: string;
};

/** 折线在 viewBox 内的逻辑宽度；布局宽度用 svgLayoutW，避免 Web 上整窗宽撑爆纵向 ScrollView */
const CHART_VB_W = 360;

function shortDate(d: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  if (m) return `${m[2]}/${m[3]}`;
  return d.length > 5 ? d.slice(5) : d;
}

export function MiniTrendChart({
  data,
  height = 80,
  color = '#b5ff3a',
}: MiniTrendChartProps) {
  const { width: winW } = useWindowDimensions();
  const svgLayoutW = Math.min(CHART_VB_W, Math.max(200, Math.min(winW, 900) - 40));
  const pad = 8;
  const plotW = CHART_VB_W - pad * 2;
  const plotH = height - pad * 2 - 18;

  const series = data
    .map((d) => ({ date: d.date, value: d.value }))
    .filter((d): d is { date: string; value: number } => d.value != null && Number.isFinite(d.value));

  if (series.length < 3) {
    return (
      <View style={[styles.fallback, { height: height + 22 }]}>
        <Text style={styles.fallbackTxt}>需要更多数据</Text>
      </View>
    );
  }

  const values = series.map((s) => s.value);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const span = maxV - minV || 1;

  const pts = series.map((s, i) => {
    const x = pad + (series.length === 1 ? plotW / 2 : (i / (series.length - 1)) * plotW);
    const y = pad + (1 - (s.value - minV) / span) * plotH;
    return { x, y, v: s.value, date: s.date };
  });

  const pointsStr = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  const firstDate = shortDate(series[0]!.date);
  const lastDate = shortDate(series[series.length - 1]!.date);

  return (
    <View style={styles.wrap}>
      <Svg
        width={svgLayoutW}
        height={height}
        viewBox={`0 0 ${CHART_VB_W} ${height}`}
        preserveAspectRatio="xMidYMid meet">
        <Polyline points={pointsStr} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={4} fill={color} />
        ))}
      </Svg>
      <View style={styles.dateRow}>
        <Text style={styles.dateTxt}>{firstDate}</Text>
        <Text style={styles.dateTxt}>{lastDate}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', maxWidth: '100%', alignSelf: 'stretch', overflowX: 'hidden' },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingHorizontal: 4,
  },
  dateTxt: { fontSize: 11, color: 'rgba(255,255,255,0.45)' },
  fallback: { justifyContent: 'center', alignItems: 'center', paddingVertical: 16 },
  fallbackTxt: { fontSize: 13, color: 'rgba(255,255,255,0.45)', textAlign: 'center' },
});
