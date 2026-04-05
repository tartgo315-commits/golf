/**
 * Golf fitting data & quiz logic — keep in sync with `golf-knowledge.md`.
 * UI strings use i18n keys under `fit.*` in locales/fitting-en.json & fitting-zh.json.
 */

export type ClubCategory = 'driver' | 'fairway' | 'hybrid' | 'irons' | 'wedges' | 'putter';

export type QuizOptionDef = {
  id: string;
  labelKey: string;
  tags: string[];
};

export type QuizQuestionDef = {
  id: string;
  promptKey: string;
  options: QuizOptionDef[];
};

export type ProductDef = {
  id: string;
  priceRange: string;
  tags: string[];
};

export type UserProfileFit = {
  skillLevel: 'beginner' | 'intermediate' | 'advanced';
  ageGroup: 'junior' | 'adult' | 'senior';
  dominantHand: 'left' | 'right';
};

function q(questionId: string, optionTagSets: string[][]): QuizQuestionDef {
  return {
    id: questionId,
    promptKey: `fit.quiz.p.${questionId}`,
    options: optionTagSets.map((tags, i) => ({
      id: `${questionId}-o${i + 1}`,
      labelKey: `fit.quiz.o.${questionId}-o${i + 1}`,
      tags,
    })),
  };
}

const driverProducts: ProductDef[] = [
  { id: 'drv-forgiving', priceRange: '$399–$549', tags: ['max-forgiveness', 'high-launch', 'mid-spin', 'lightweight'] },
  { id: 'drv-lowspin', priceRange: '$529–$699', tags: ['low-spin', 'workable', 'stiff-profile', 'penetrating'] },
  { id: 'drv-draw', priceRange: '$349–$479', tags: ['draw-bias-ok', 'high-launch', 'max-forgiveness', 'mid-spin'] },
];

const fairwayProducts: ProductDef[] = [
  { id: 'fw-high', priceRange: '$279–$379', tags: ['high-launch', 'max-forgiveness', 'rail-sole'] },
  { id: 'fw-compact', priceRange: '$329–$449', tags: ['low-spin', 'workable', 'penetrating'] },
  { id: 'fw-versatile', priceRange: '$259–$359', tags: ['mid-launch', 'all-around', 'max-forgiveness'] },
];

const hybridProducts: ProductDef[] = [
  { id: 'hy-rescue', priceRange: '$229–$319', tags: ['high-launch', 'max-forgiveness', 'offset-ok'] },
  { id: 'hy-compact', priceRange: '$249–$349', tags: ['low-spin', 'workable', 'penetrating'] },
  { id: 'hy-dual', priceRange: '$219–$299', tags: ['penetrating', 'mid-launch', 'all-around'] },
];

const ironProducts: ProductDef[] = [
  { id: 'ir-gi', priceRange: '$699–$899', tags: ['max-forgiveness', 'high-launch', 'wide-sole'] },
  { id: 'ir-pd', priceRange: '$899–$1,199', tags: ['ball-speed', 'slim-topline', 'mid-forgiveness'] },
  { id: 'ir-blade', priceRange: '$1,049–$1,349', tags: ['workable', 'feedback', 'low-offset'] },
];

const wedgeProducts: ProductDef[] = [
  { id: 'wg-high', priceRange: '$149–$189', tags: ['high-bounce', 'full-sole'] },
  { id: 'wg-mid', priceRange: '$139–$179', tags: ['mid-bounce', 'all-around'] },
  { id: 'wg-low', priceRange: '$139–$179', tags: ['low-bounce', 'tight-lie'] },
];

const putterProducts: ProductDef[] = [
  { id: 'pt-mallet', priceRange: '$179–$249', tags: ['stability', 'straight-back'] },
  { id: 'pt-mid', priceRange: '$199–$269', tags: ['arc-friendly', 'mid-toe-hang'] },
  { id: 'pt-blade', priceRange: '$159–$229', tags: ['toe-hang', 'feedback'] },
];

export const productsByCategory: Record<ClubCategory, ProductDef[]> = {
  driver: driverProducts,
  fairway: fairwayProducts,
  hybrid: hybridProducts,
  irons: ironProducts,
  wedges: wedgeProducts,
  putter: putterProducts,
};

export const quizByCategory: Record<ClubCategory, QuizQuestionDef[]> = {
  driver: [
    q('drv-1', [['high-launch', 'draw-bias-ok'], ['low-spin', 'penetrating'], ['max-forgiveness', 'mid-spin'], ['lightweight', 'high-launch']]),
    q('drv-2', [['lightweight', 'high-launch'], ['stiff-profile', 'low-spin'], ['max-forgiveness', 'high-launch'], ['mid-spin', 'all-around']]),
    q('drv-3', [['draw-bias-ok', 'max-forgiveness'], ['workable', 'low-spin'], ['high-launch', 'max-forgiveness'], ['mid-spin', 'max-forgiveness']]),
    q('drv-4', [['max-forgiveness'], ['low-spin'], ['high-launch'], ['workable']]),
  ],
  fairway: [
    q('fw-1', [['rail-sole', 'high-launch'], ['low-spin', 'workable'], ['penetrating', 'low-spin'], ['high-launch', 'max-forgiveness']]),
    q('fw-2', [['all-around', 'mid-launch'], ['high-launch', 'max-forgiveness'], ['workable', 'low-spin'], ['max-forgiveness', 'high-launch']]),
    q('fw-3', [['high-launch'], ['penetrating', 'mid-launch'], ['low-spin'], ['max-forgiveness']]),
    q('fw-4', [['max-forgiveness'], ['low-spin', 'penetrating'], ['all-around'], ['workable']]),
  ],
  hybrid: [
    q('hy-1', [['high-launch', 'offset-ok'], ['penetrating', 'workable'], ['mid-launch', 'all-around'], ['max-forgiveness', 'high-launch']]),
    q('hy-2', [['rail-sole', 'high-launch'], ['mid-launch', 'all-around'], ['low-spin', 'workable'], ['max-forgiveness', 'high-launch']]),
    q('hy-3', [['high-launch'], ['mid-launch'], ['penetrating', 'low-spin'], ['max-forgiveness']]),
    q('hy-4', [['max-forgiveness', 'offset-ok'], ['workable', 'low-spin'], ['all-around'], ['max-forgiveness']]),
  ],
  irons: [
    q('ir-1', [['max-forgiveness', 'wide-sole'], ['mid-forgiveness', 'ball-speed'], ['workable', 'feedback'], ['ball-speed', 'mid-forgiveness']]),
    q('ir-2', [['max-forgiveness'], ['mid-forgiveness', 'ball-speed'], ['workable', 'low-offset'], ['mid-forgiveness']]),
    q('ir-3', [['wide-sole', 'high-launch'], ['high-launch', 'max-forgiveness'], ['all-around', 'mid-forgiveness'], ['ball-speed']]),
    q('ir-4', [['max-forgiveness'], ['ball-speed', 'high-launch'], ['workable', 'feedback'], ['mid-forgiveness']]),
  ],
  wedges: [
    q('wg-1', [['high-bounce', 'full-sole'], ['mid-bounce', 'all-around'], ['low-bounce', 'tight-lie'], ['mid-bounce', 'all-around']]),
    q('wg-2', [['high-bounce', 'full-sole'], ['low-bounce', 'tight-lie'], ['mid-bounce'], ['mid-bounce', 'all-around']]),
    q('wg-3', [['mid-bounce', 'all-around'], ['low-bounce'], ['mid-bounce', 'max-forgiveness'], ['all-around']]),
    q('wg-4', [['all-around'], ['mid-bounce', 'high-bounce'], ['mid-bounce', 'tight-lie'], ['mid-bounce']]),
  ],
  putter: [
    q('pt-1', [['stability', 'straight-back'], ['arc-friendly', 'mid-toe-hang'], ['toe-hang'], ['mid-toe-hang']]),
    q('pt-2', [['stability', 'feedback'], ['stability'], ['straight-back'], ['mid-toe-hang']]),
    q('pt-3', [['stability'], ['arc-friendly'], ['toe-hang', 'feedback'], ['mid-toe-hang']]),
    q('pt-4', [['straight-back', 'stability'], ['feedback'], ['stability'], ['arc-friendly', 'toe-hang']]),
  ],
};

export function isClubCategory(value: string): value is ClubCategory {
  return value in quizByCategory;
}

function collectTagsFromAnswers(
  category: ClubCategory,
  answers: Record<string, string>,
): Map<string, number> {
  const questions = quizByCategory[category];
  const weights = new Map<string, number>();
  for (const question of questions) {
    const optionId = answers[question.id];
    if (!optionId) continue;
    const opt = question.options.find((o) => o.id === optionId);
    if (!opt) continue;
    for (const tag of opt.tags) {
      weights.set(tag, (weights.get(tag) ?? 0) + 1);
    }
  }
  return weights;
}

function applyProfileBoosts(profile: UserProfileFit | null, weights: Map<string, number>) {
  if (!profile) return;
  const add = (tag: string, w: number) => weights.set(tag, (weights.get(tag) ?? 0) + w);
  if (profile.skillLevel === 'beginner') {
    add('max-forgiveness', 1.5);
    add('high-launch', 0.5);
  } else if (profile.skillLevel === 'advanced') {
    add('workable', 1);
    add('low-spin', 0.5);
  }
  if (profile.ageGroup === 'junior' || profile.ageGroup === 'senior') {
    add('lightweight', 0.75);
    add('high-launch', 0.5);
  }
  if (profile.dominantHand === 'left') {
    add('all-around', 0.25);
  }
}

function scoreProduct(product: ProductDef, weights: Map<string, number>): number {
  let score = 0;
  for (const tag of product.tags) {
    score += weights.get(tag) ?? 0;
  }
  return score;
}

export type RecommendationResult = {
  product: ProductDef;
  score: number;
  topTags: string[];
};

export function getRecommendation(
  category: ClubCategory,
  answers: Record<string, string>,
  profile: UserProfileFit | null,
): RecommendationResult {
  const weights = collectTagsFromAnswers(category, answers);
  applyProfileBoosts(profile, weights);

  const products = productsByCategory[category];
  let best = products[0];
  let bestScore = scoreProduct(best, weights);

  for (let i = 1; i < products.length; i++) {
    const p = products[i];
    const s = scoreProduct(p, weights);
    if (s > bestScore) {
      best = p;
      bestScore = s;
    }
  }

  const topTags = [...weights.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([t]) => t);

  return { product: best, score: bestScore, topTags };
}

export function isQuizComplete(category: ClubCategory, answers: Record<string, string>): boolean {
  const qs = quizByCategory[category];
  return qs.every((qItem) => Boolean(answers[qItem.id]));
}
