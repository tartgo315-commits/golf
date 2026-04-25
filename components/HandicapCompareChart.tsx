import { useMemo } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';

const STROKE_ME = '#b5ff3a';
const STROKE_FRIEND = 'rgba(232,155,58,0.8)';
const GRID = 'rgba(255,255,255,0.08)';
const LABEL = '#8a9a8e';
const HEIGHT = 120;
const PAD_L = 28;
const PAD_R = 8;
const PAD_Y = 14;

export type HiPoint = { date: string; hi: number };

type Props = {
  myPoints: HiPoint[];
  friendPoints: HiPoint[];
  myName: string;
  friendName: string;
  range: 5 | 10 | 20;
};

function sliceLast(points: HiPoint[], n: number): HiPoint[] {
  if (points.length === 0) return [];
  const take = Math.min(n, points.length);
  return points.slice(-take);
}

export function HandicapCompareChart({ myPoints, friendPoints, myName, friendName, range }: Props) {
  const { width: winW } = useWindowDimensions();
  const width = Math.max(280, Math.min(winW - 32, 360));

  const { a, xLabels, yMin, yMax, lineMe, lineFr, lastMe, lastFr } = useMemo(() => {
    const myS = sliceLast(myPoints, range);
    const frS = sliceLast(friendPoints, range);
    const n = Math.min(myS.length, frS.length);
    if (n < 1) {
      return {
        a: [] as HiPoint[],
        xLabels: [] as string[],
        yMin: 0,
        yMax: 1,
        lineMe: '',
        lineFr: '',
        lastMe: null as { x: number; y: number } | null,
        lastFr: null as { x: number; y: number } | null,
      };
    }
    const a = myS.slice(-n);
    const b = frS.slice(-n);
    const vals = [...a.map((p) => p.hi), ...b.map((p) => p.hi)];
    const rawMin = Math.min(...vals);
    const rawMax = Math.max(...vals);
    const pad = Math.max(0.5, (rawMax - rawMin) * 0.1) || 0.5;
    const yMin = rawMin - pad;
    const yMax = rawMax + pad;
    const innerW = width - PAD_L - PAD_R;
    const innerH = HEIGHT - PAD_Y * 2;
    const toX = (i: number) => PAD_L + (n === 1 ? innerW / 2 : (innerW * i) / (n - 1));
    const toY = (v: number) => PAD_Y + innerH - (innerH * (v - yMin)) / (yMax - yMin || 1);
    const ptsMe = a.map((p, i) => ({ x: toX(i), y: toY(p.hi) }));
    const ptsFr = b.map((p, i) => ({ x: toX(i), y: toY(p.hi) }));
    const lineMe = ptsMe.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const lineFr = ptsFr.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const xLabels = a.map((p) => {
      const d = new Date(p.date);
      if (!Number.isFinite(d.getTime())) return p.date.slice(5);
      return `${d.getMonth() + 1}/${d.getDate()}`;
    });
    const lastMe = ptsMe[ptsMe.length - 1] ?? null;
    const lastFr = ptsFr[ptsFr.length - 1] ?? null;
    return { a, xLabels, yMin, yMax, lineMe, lineFr, lastMe, lastFr };
  }, [myPoints, friendPoints, range, width]);

  if (a.length < 1) {
    return (
      <View style={[styles.emptyWrap, { width }]}>
        <Text style={styles.emptyTxt}>双方记录不足，暂无对比曲线</Text>
      </View>
    );
  }

  const innerH = HEIGHT - PAD_Y * 2;
  const yTicks = [yMax, (yMax + yMin) / 2, yMin];

  return (
    <View style={{ width }}>
      <Svg width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`}>
        <Line x1={PAD_L} y1={PAD_Y} x2={PAD_L} y2={HEIGHT - PAD_Y} stroke={GRID} strokeWidth={1} />
        <Line
          x1={PAD_L}
          y1={HEIGHT - PAD_Y}
          x2={width - PAD_R}
          y2={HEIGHT - PAD_Y}
          stroke={GRID}
          strokeWidth={1}
        />
        {yTicks.map((yv, i) => {
          const y = PAD_Y + innerH - (innerH * (yv - yMin)) / (yMax - yMin || 1);
          return (
            <SvgText key={`yt-${i}`} x={4} y={y + 4} fill={LABEL} fontSize={9} fontWeight="600">
              {yv.toFixed(1)}
            </SvgText>
          );
        })}
        {lineMe ? (
          <Polyline
            points={lineMe}
            fill="none"
            stroke={STROKE_ME}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
        {lineFr ? (
          <Polyline
            points={lineFr}
            fill="none"
            stroke={STROKE_FRIEND}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
        {lastMe ? <Circle cx={lastMe.x} cy={lastMe.y} r={4} fill={STROKE_ME} /> : null}
        {lastFr ? <Circle cx={lastFr.x} cy={lastFr.y} r={4} fill="rgba(232,155,58,1)" /> : null}
      </Svg>
      <View style={[styles.tickRow, { width, paddingLeft: PAD_L }]}>
        {xLabels.map((lab, i) => (
          <Text key={`${lab}-${i}`} style={styles.tickTxt} numberOfLines={1}>
            {lab}
          </Text>
        ))}
      </View>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: STROKE_ME }]} />
          <Text style={styles.legendTxt} numberOfLines={1}>
            {myName}
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: 'rgba(232,155,58,0.9)' }]} />
          <Text style={styles.legendTxt} numberOfLines={1}>
            {friendName}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyWrap: { height: HEIGHT, alignItems: 'center', justifyContent: 'center' },
  emptyTxt: { color: '#5a6b5f', fontSize: 12, fontWeight: '600' },
  tickRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingRight: PAD_R,
  },
  tickTxt: { flex: 1, fontSize: 10, fontWeight: '600', color: LABEL, textAlign: 'center' },
  legend: { flexDirection: 'row', gap: 16, marginTop: 10, paddingLeft: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '46%' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendTxt: { fontSize: 11, fontWeight: '600', color: '#a8b5ac', flex: 1 },
});
