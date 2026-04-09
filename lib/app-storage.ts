export const USER_PROFILE_KEY = 'user_profile';
export const FAVORITES_KEY = 'favorites';

export type StoredUserProfile = {
  swingSpeedMph: string;
  handicap: string;
  heightCm: string;
  age: string;
  weightKg: string;
  dominantHand: 'left' | 'right';
  wristToFloorCm?: string;
  handCircumferenceCm?: string;
  ballFlight?: 'high' | 'mid' | 'low';
  shotShape?: 'straight' | 'draw' | 'fade' | 'slice' | 'hook';
  swingTempo?: 'slow' | 'medium' | 'fast';
  yearsPlaying?: string;
  budgetPerClub?: string;
  currentBrand?: string;
  updatedAt: string;
};

export type FavoriteRecommendation = {
  id: string;
  type: string;
  model: string;
  savedAt: string;
};
