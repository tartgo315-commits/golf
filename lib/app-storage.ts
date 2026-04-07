export const USER_PROFILE_KEY = 'user_profile';
export const FAVORITES_KEY = 'favorites';

export type StoredUserProfile = {
  swingSpeedMph: string;
  handicap: string;
  heightCm: string;
  dominantHand: 'left' | 'right';
  updatedAt: string;
};

export type FavoriteRecommendation = {
  id: string;
  type: string;
  model: string;
  savedAt: string;
};
