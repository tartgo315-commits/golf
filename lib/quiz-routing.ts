export type QuizType = 'driver' | 'iron' | 'fairway' | 'wedge' | 'putter';

const TYPE_ALIAS: Record<string, QuizType> = {
  driver: 'driver',
  fairway: 'fairway',
  iron: 'iron',
  irons: 'iron',
  wedge: 'wedge',
  wedges: 'wedge',
  putter: 'putter',
};

export function normalizeClubTypeParam(value?: string): QuizType | null {
  if (!value) return null;
  return TYPE_ALIAS[value] ?? null;
}
