import type { Session, UserProfile } from '@/contexts/auth-context';

/** Playwright / E2E 用固定用户（无 Supabase 网络依赖） */
export const E2E_MOCK_USER_ID = '00000000-0000-4000-8000-000000000e2e';

export const E2E_MOCK_PROFILE: UserProfile = {
  heightCm: 175,
  weightKg: 72,
  dominantHand: 'right',
  skillLevel: 'intermediate',
  ageGroup: 'adult',
};

export const E2E_MOCK_SESSION: Session = {
  email: 'e2e@golfclubadvisor.test',
  provider: 'email',
  userId: E2E_MOCK_USER_ID,
  nickname: 'E2E',
  profile: E2E_MOCK_PROFILE,
};
