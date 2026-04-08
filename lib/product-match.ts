import type { StoredUserProfile } from '@/lib/app-storage';
import type { ProductItem } from '@/lib/product-db';

export type MatchResult = {
  score: number;
  reasons: string[];
  summary: '适合' | '基本适合' | '不太适合';
};

function parseRange(text: string): { min?: number; max?: number } | null {
  const normalized = text.replace(/\s/g, '');
  if (normalized.includes('+')) {
    const n = Number(normalized.replace('+', '').replace('以上', ''));
    return Number.isFinite(n) ? { min: n } : null;
  }
  if (normalized.includes('-')) {
    const [a, b] = normalized.split('-').map((v) => Number(v.replace('以下', '').replace('以上', '')));
    if (Number.isFinite(a) && Number.isFinite(b)) return { min: a, max: b };
  }
  if (normalized.includes('以下')) {
    const n = Number(normalized.replace('以下', ''));
    return Number.isFinite(n) ? { max: n } : null;
  }
  if (normalized.includes('以上')) {
    const n = Number(normalized.replace('以上', ''));
    return Number.isFinite(n) ? { min: n } : null;
  }
  return null;
}

function inRange(value: number, range: { min?: number; max?: number }) {
  if (typeof range.min === 'number' && value < range.min) return false;
  if (typeof range.max === 'number' && value > range.max) return false;
  return true;
}

export function evaluateProductMatch(product: ProductItem, profile: StoredUserProfile | null): MatchResult {
  const speed = Number(profile?.swingSpeedMph) || 90;
  const handicap = Number(profile?.handicap) || 15;
  const height = Number(profile?.heightCm) || 170;

  let score = 50;
  const reasons: string[] = [];

  const speedRangeText = product.params['适合挥速'];
  if (speedRangeText) {
    const range = parseRange(speedRangeText);
    if (range && inRange(speed, range)) {
      score += 20;
      reasons.push(`你的挥速${speed}mph处于推荐区间（${speedRangeText}）✓`);
    } else {
      score -= 10;
      reasons.push(`你的挥速${speed}mph与推荐区间（${speedRangeText}）略有偏差`);
    }
  }

  const hcpRangeText = product.params['适合差点'];
  if (hcpRangeText) {
    const range = parseRange(hcpRangeText);
    if (range && inRange(handicap, range)) {
      score += 20;
      reasons.push(`你的差点${handicap}与该产品定位匹配（${hcpRangeText}）✓`);
    } else {
      score -= 10;
      reasons.push(`你的差点${handicap}与定位（${hcpRangeText}）存在差异`);
    }
  } else if (product.crowdTag === '宽容' && handicap >= 12) {
    score += 12;
    reasons.push(`你的差点${handicap}偏高，宽容型定位更友好 ✓`);
  } else if (product.crowdTag === '操控' && handicap <= 10) {
    score += 12;
    reasons.push(`你的差点${handicap}偏低，操控型产品更能发挥优势 ✓`);
  }

  if (height >= 180) {
    score += 5;
    reasons.push(`你的身高${height}cm较高，建议试打时关注杆长微调。`);
  } else if (height <= 165) {
    score += 5;
    reasons.push(`你的身高${height}cm偏低，建议试打时关注短杆长方案。`);
  } else {
    reasons.push(`你的身高${height}cm处于常规区间，标准长度通常可先行试打。`);
  }

  const finalScore = Math.max(0, Math.min(100, Math.round(score)));
  const summary: MatchResult['summary'] = finalScore >= 75 ? '适合' : finalScore >= 55 ? '基本适合' : '不太适合';
  return { score: finalScore, reasons: reasons.slice(0, 3), summary };
}
