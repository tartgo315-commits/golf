import Svg, { Circle, Path } from 'react-native-svg';

const VB = 24;
const SW = 1.65;

/**
 * 底部 Tab 线框图标（SVG，不依赖 @expo/vector-icons 字体，Web 慢网也不会空白）。
 */
export function TabSvgHome({ color, size = 24 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${VB} ${VB}`}>
      <Path
        d="M3 9.5L12 4l9 5.5V20h-5.5v-6.5H8.5V20H3V9.5z"
        fill="none"
        stroke={color}
        strokeWidth={SW}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function TabSvgScore({ color, size = 24 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${VB} ${VB}`}>
      <Path
        d="M8 3.5h8a2.5 2.5 0 012.5 2.5v12a2.5 2.5 0 01-2.5 2.5H8a2.5 2.5 0 01-2.5-2.5V6A2.5 2.5 0 018 3.5z"
        fill="none"
        stroke={color}
        strokeWidth={SW}
      />
      <Path d="M9 9h6M9 12.5h6M9 16h4.5" stroke={color} strokeWidth={1.45} strokeLinecap="round" />
    </Svg>
  );
}

export function TabSvgHandicap({ color, size = 24 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${VB} ${VB}`}>
      <Path
        d="M4 16.5L8.5 9l3.5 4.5L16 6.5l4 5.5"
        fill="none"
        stroke={color}
        strokeWidth={SW}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function TabSvgFitting({ color, size = 24 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${VB} ${VB}`}>
      <Path d="M6.5 19L16.5 6" stroke={color} strokeWidth={1.85} strokeLinecap="round" />
      <Circle cx="17.2" cy="5.2" r="2.35" fill="none" stroke={color} strokeWidth={SW} />
    </Svg>
  );
}

export function TabSvgBet({ color, size = 24 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${VB} ${VB}`}>
      <Circle cx="12" cy="12" r="7.5" fill="none" stroke={color} strokeWidth={SW} />
      <Path d="M12 12V7.8M12 12l3.8 2.2" stroke={color} strokeWidth={1.45} strokeLinecap="round" />
    </Svg>
  );
}
